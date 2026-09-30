import { useEffect, useState } from 'react';
import { Button, Form, Input, NavBar, Switch, Toast } from 'antd-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { createAddress, listAddresses, updateAddress } from '../api/trade';
import type { AddressPayload } from '../api/trade';
import { getErrorMessage } from '../api/request';

export default function AddressEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : undefined;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 编辑时回填
  useEffect(() => {
    if (!editingId) return;
    void (async () => {
      try {
        const res = await listAddresses();
        const a = res.data.data.find((x) => x.id === editingId);
        if (a) form.setFieldsValue({ ...a, isDefault: a.isDefault === 1 });
      } catch {
        /* 忽略回填失败 */
      }
    })();
  }, [editingId, form]);

  const submit = async () => {
    let values: AddressPayload & { isDefault: boolean };
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setLoading(true);
    try {
      const payload: AddressPayload = {
        receiverName: values.receiverName,
        receiverPhone: values.receiverPhone,
        province: values.province,
        city: values.city,
        district: values.district,
        detail: values.detail,
        isDefault: values.isDefault ? 1 : 0,
      };
      if (editingId) {
        await updateAddress(editingId, payload);
      } else {
        await createAddress(payload);
      }
      Toast.show({ content: '保存成功', icon: 'success' });
      navigate(-1);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>{editingId ? '编辑地址' : '新增地址'}</NavBar>
      <div className="addr-form">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ isDefault: false }}
          footer={
            <Button
              block
              color="primary"
              size="large"
              loading={loading}
              onClick={() => void submit()}
            >
              保存
            </Button>
          }
        >
          <Form.Item
            name="receiverName"
            label="收货人"
            rules={[{ required: true, message: '请输入收货人' }]}
          >
            <Input placeholder="收货人姓名" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="receiverPhone"
            label="手机号"
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input placeholder="收货人手机号" type="tel" maxLength={20} />
          </Form.Item>
          <Form.Item
            name="province"
            label="省份"
            rules={[{ required: true, message: '请输入省份' }]}
          >
            <Input placeholder="省份" maxLength={30} />
          </Form.Item>
          <Form.Item name="city" label="城市" rules={[{ required: true, message: '请输入城市' }]}>
            <Input placeholder="城市" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="district"
            label="区县"
            rules={[{ required: true, message: '请输入区县' }]}
          >
            <Input placeholder="区县" maxLength={30} />
          </Form.Item>
          <Form.Item
            name="detail"
            label="详细地址"
            rules={[{ required: true, message: '请输入详细地址' }]}
          >
            <Input placeholder="街道、门牌号等" maxLength={200} />
          </Form.Item>
          <Form.Item name="isDefault" label="设为默认地址" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
