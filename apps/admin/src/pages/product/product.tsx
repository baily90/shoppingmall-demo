import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as productApi from '../../api/product';
import type {
  BrandRow,
  CategoryNode,
  CreateProductPayload,
  ProductDetail,
  ProductRow,
  SkuRow,
} from '../../api/product';
import { ImageUpload, MultiImageUpload } from '../../components/ImageUpload';

const STATUS_OPTIONS = [
  { value: 1, label: '上架' },
  { value: 0, label: '下架' },
];

// 分 <-> 元 换算（后端统一用「分」存储金额）
const yuanToCent = (yuan: number) => Math.round(yuan * 100);
const centToYuan = (cent: number) => cent / 100;

function flattenCategories(nodes: CategoryNode[], prefix = ''): { value: number; label: string }[] {
  return nodes.flatMap((n) => {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    return [{ value: n.id, label }, ...flattenCategories(n.children, label)];
  });
}

export default function ProductList() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();

  // ---- 列表 ----
  const [data, setData] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();
  const [filterBrandId, setFilterBrandId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<number | undefined>();

  // ---- 下拉数据源 ----
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);

  // ---- 新建/编辑抽屉 ----
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDetail | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [form] = Form.useForm();

  // ---- SKU 管理抽屉 ----
  const [skuOpen, setSkuOpen] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const [skuSaving, setSkuSaving] = useState(false);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);

  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);
  const brandOptions = useMemo(() => brands.map((b) => ({ value: b.id, label: b.name })), [brands]);

  const load = useCallback(async () => {
    try {
      const res = await productApi.listProducts({
        page,
        pageSize,
        keyword: keyword || undefined,
        categoryId: filterCategoryId,
        brandId: filterBrandId,
        status: filterStatus,
      });
      setData(res.data.data.list);
      setTotal(res.data.data.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, keyword, filterCategoryId, filterBrandId, filterStatus]);

  const loadOptions = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        productApi.listCategories(),
        productApi.listBrands({ page: 1, pageSize: 999 }),
      ]);
      setCategories(catRes.data.data);
      setBrands(brandRes.data.data.list);
    } catch {
      /* 忽略下拉数据加载失败 */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setDrawerOpen(true);
  };

  const openEdit = async (row: ProductRow) => {
    try {
      const res = await productApi.getProduct(row.id);
      setEditing(res.data.data);
      setFormKey((k) => k + 1);
      setDrawerOpen(true);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  // 打开时显式写入表单值：form store 在切换记录间不会自动清空，必须手动同步
  useEffect(() => {
    if (!drawerOpen) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        subTitle: editing.subTitle ?? undefined,
        categoryId: editing.categoryId,
        brandId: editing.brandId,
        mainImage: editing.mainImage,
        detail: editing.detail ?? undefined,
        status: editing.status,
        sort: editing.sort,
        images: editing.images.map((i) => i.url),
      });
    } else {
      form.setFieldsValue({
        name: undefined,
        subTitle: undefined,
        categoryId: undefined,
        brandId: undefined,
        mainImage: undefined,
        detail: undefined,
        status: 1,
        sort: 0,
        images: [],
        specGroups: [],
      });
    }
  }, [drawerOpen, editing, form]);

  const handleSubmit = async () => {
    let values: CreateProductPayload;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await productApi.updateProduct(editing.id, values);
        message.success('保存成功');
      } else {
        await productApi.createProduct(values);
        message.success('新增成功');
      }
      setDrawerOpen(false);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: ProductRow) => {
    try {
      await productApi.deleteProduct(row.id);
      message.success('删除成功');
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const openSku = async (row: ProductRow) => {
    setSkuOpen(true);
    setSkuLoading(true);
    setSkuRows([]);
    try {
      const res = await productApi.getProduct(row.id);
      setSkuRows(res.data.data.skus.map((s) => ({ ...s })));
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSkuLoading(false);
    }
  };

  const patchSkuRow = (id: number, patch: Partial<SkuRow>) => {
    setSkuRows((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleSaveSkus = async () => {
    setSkuSaving(true);
    try {
      await Promise.all(
        skuRows.map((s) =>
          productApi.updateSku(s.id, {
            price: s.price,
            originalPrice: s.originalPrice,
            stock: s.stock,
            skuCode: s.skuCode,
            status: s.status,
          }),
        ),
      );
      message.success('SKU 已保存');
      setSkuOpen(false);
      await reload();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSkuSaving(false);
    }
  };

  const columns: ColumnsType<ProductRow> = [
    {
      title: '商品',
      dataIndex: 'name',
      render: (name: string, row) => (
        <Space>
          <img src={row.mainImage} alt="" style={{ width: 44, height: 44, objectFit: 'cover' }} />
          <div>
            <div>{name}</div>
            {row.subTitle && <div style={{ color: '#999', fontSize: 12 }}>{row.subTitle}</div>}
          </div>
        </Space>
      ),
    },
    { title: '分类', width: 120, render: (_, row) => row.category?.name ?? '-' },
    { title: '品牌', width: 120, render: (_, row) => row.brand?.name ?? '-' },
    {
      title: 'SKU 数',
      dataIndex: ['_count', 'skus'],
      width: 90,
      render: (n: number) => <Tag>{n}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) =>
        s === 1 ? <Tag color="green">上架</Tag> : <Tag color="red">下架</Tag>,
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, row) => (
        <Space size="small">
          {hasPermission('product:update') && (
            <Button size="small" onClick={() => openSku(row)}>
              SKU
            </Button>
          )}
          {hasPermission('product:update') && (
            <Button size="small" type="link" onClick={() => openEdit(row)}>
              编辑
            </Button>
          )}
          {hasPermission('product:delete') && (
            <Popconfirm title="确认删除该商品？" onConfirm={() => handleDelete(row)}>
              <Button size="small" type="link" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const skuColumns: ColumnsType<SkuRow> = [
    {
      title: '规格',
      dataIndex: 'specValues',
      render: (specValues: SkuRow['specValues']) =>
        specValues.map((v) => `${v.groupName}:${v.value}`).join(' / '),
    },
    {
      title: '售价(元)',
      width: 120,
      render: (_, row) => (
        <InputNumber
          min={0}
          precision={2}
          value={centToYuan(row.price)}
          onChange={(v) => patchSkuRow(row.id, { price: yuanToCent(v ?? 0) })}
        />
      ),
    },
    {
      title: '原价(元)',
      width: 120,
      render: (_, row) => (
        <InputNumber
          min={0}
          precision={2}
          value={row.originalPrice != null ? centToYuan(row.originalPrice) : undefined}
          placeholder="无"
          onChange={(v) => patchSkuRow(row.id, { originalPrice: v != null ? yuanToCent(v) : null })}
        />
      ),
    },
    {
      title: '库存',
      width: 100,
      render: (_, row) => (
        <InputNumber
          min={0}
          precision={0}
          value={row.stock}
          onChange={(v) => patchSkuRow(row.id, { stock: v ?? 0 })}
        />
      ),
    },
    {
      title: 'SKU 编码',
      width: 150,
      render: (_, row) => (
        <Input
          value={row.skuCode ?? ''}
          placeholder="可选"
          onChange={(e) => patchSkuRow(row.id, { skuCode: e.target.value || null })}
        />
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_, row) => (
        <Select
          value={row.status}
          options={STATUS_OPTIONS}
          onChange={(v) => patchSkuRow(row.id, { status: v })}
        />
      ),
    },
  ];

  return (
    <>
      {/* 筛选栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Space wrap>
          {hasPermission('product:create') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增商品
            </Button>
          )}
          <Input.Search
            allowClear
            placeholder="搜索商品名"
            style={{ width: 200 }}
            onSearch={(v) => {
              setPage(1);
              setKeyword(v.trim());
            }}
          />
          <Select
            allowClear
            placeholder="分类"
            style={{ width: 160 }}
            options={categoryOptions}
            value={filterCategoryId}
            onChange={(v) => {
              setPage(1);
              setFilterCategoryId(v);
            }}
          />
          <Select
            allowClear
            placeholder="品牌"
            style={{ width: 140 }}
            options={brandOptions}
            value={filterBrandId}
            onChange={(v) => {
              setPage(1);
              setFilterBrandId(v);
            }}
          />
          <Select
            allowClear
            placeholder="状态"
            style={{ width: 120 }}
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={(v) => {
              setPage(1);
              setFilterStatus(v);
            }}
          />
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* 新建/编辑抽屉 */}
      <Drawer
        title={editing ? '编辑商品' : '新增商品'}
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form
          key={formKey}
          form={form}
          layout="vertical"
          initialValues={
            editing
              ? {
                  name: editing.name,
                  subTitle: editing.subTitle ?? undefined,
                  categoryId: editing.categoryId,
                  brandId: editing.brandId,
                  mainImage: editing.mainImage,
                  detail: editing.detail ?? undefined,
                  status: editing.status,
                  sort: editing.sort,
                  images: editing.images.map((i) => i.url),
                }
              : { status: 1, sort: 0, images: [] }
          }
        >
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input maxLength={60} />
          </Form.Item>
          <Form.Item name="subTitle" label="副标题">
            <Input maxLength={120} />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item
              name="categoryId"
              label="分类"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select style={{ width: 240 }} options={categoryOptions} placeholder="请选择" />
            </Form.Item>
            <Form.Item
              name="brandId"
              label="品牌"
              rules={[{ required: true, message: '请选择品牌' }]}
            >
              <Select style={{ width: 240 }} options={brandOptions} placeholder="请选择" />
            </Form.Item>
          </Space>

          <Form.Item
            name="mainImage"
            label="主图"
            rules={[{ required: true, message: '请上传主图' }]}
          >
            <ImageUpload />
          </Form.Item>

          <Form.Item name="images" label="轮播图（最多 5 张）">
            <MultiImageUpload />
          </Form.Item>

          <Form.Item name="detail" label="商品详情">
            <Input.TextArea rows={4} placeholder="富文本/详情内容" />
          </Form.Item>

          <Space size="large" style={{ display: 'flex' }} align="start">
            <Form.Item name="status" label="状态">
              <Select style={{ width: 120 }} options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="sort" label="排序">
              <InputNumber min={0} />
            </Form.Item>
          </Space>

          {/* 规格：仅新建时可编辑（后端暂不支持改规格） */}
          {!editing && (
            <Form.Item label="规格（SKU 组合）">
              <Form.List name="specGroups">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        style={{ marginBottom: 8 }}
                        title={`规格 ${name + 1}`}
                        extra={
                          <Button size="small" type="link" danger onClick={() => remove(name)}>
                            删除
                          </Button>
                        }
                      >
                        <Space align="baseline" style={{ display: 'flex' }} wrap>
                          <Form.Item
                            {...restField}
                            name={[name, 'name']}
                            rules={[{ required: true, message: '填规格名' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="规格名，如 颜色" style={{ width: 160 }} />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, 'values']}
                            rules={[{ required: true, message: '至少一个规格值' }]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <Select
                              mode="tags"
                              placeholder="规格值，回车添加，如 红 / 蓝"
                              open={false}
                              style={{ minWidth: 220 }}
                            />
                          </Form.Item>
                        </Space>
                      </Card>
                    ))}
                    <Button
                      type="dashed"
                      block
                      icon={<PlusOutlined />}
                      onClick={() => add({ name: '', values: [] })}
                    >
                      添加规格
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* SKU 管理抽屉 */}
      <Drawer
        title="SKU 管理"
        width={820}
        open={skuOpen}
        onClose={() => setSkuOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setSkuOpen(false)}>取消</Button>
            <Button type="primary" loading={skuSaving} onClick={handleSaveSkus}>
              保存修改
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={skuLoading}
          dataSource={skuRows}
          columns={skuColumns}
          pagination={false}
        />
      </Drawer>
    </>
  );
}
