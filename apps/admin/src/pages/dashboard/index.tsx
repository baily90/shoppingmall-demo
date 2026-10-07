import { useEffect, useState } from 'react';
import { Card, Col, Empty, Progress, Row, Spin, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../../store/auth';
import { getErrorMessage } from '../../api/request';
import * as statsApi from '../../api/stats';
import type { HotProduct, Overview } from '../../api/stats';
import { ORDER_STATUS } from '../../api/order';

// 分 -> 元（后端统一用「分」存储金额）
const centToYuan = (cent: number) => (cent / 100).toFixed(2);

// 各状态进度条颜色（antd 的 Tag color 里 'default' 不是合法颜色，单独映射）
const STATUS_BAR_COLOR: Record<number, string> = {
  10: '#faad14', // 待支付
  20: '#1677ff', // 待发货
  30: '#13c2c2', // 已发货
  40: '#52c41a', // 已完成
  50: '#bfbfbf', // 已取消
};

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    statsApi
      .getOverview()
      .then((res) => setOverview(res.data.data))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const maxAmount = overview ? Math.max(...overview.salesTrend.map((t) => t.salesAmount), 1) : 1;

  const hotColumns: ColumnsType<HotProduct> = [
    { title: '排名', width: 70, render: (_, __, i) => i + 1 },
    { title: '商品', dataIndex: 'productName' },
    { title: '销量', dataIndex: 'quantity', width: 100, render: (v: number) => `${v} 件` },
    {
      title: '销售额(元)',
      dataIndex: 'amount',
      width: 140,
      render: (v: number) => `¥${centToYuan(v)}`,
    },
  ];

  return (
    <Spin spinning={loading}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        欢迎，{user?.nickname}
      </Typography.Title>

      {error ? (
        <Empty description={error} />
      ) : (
        overview && (
          <>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card>
                  <Statistic title="用户总数" value={overview.totalUsers} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    今日 +{overview.todayUsers}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="在售商品" value={overview.totalProducts} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    今日 +{overview.todayProducts}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="订单总数" value={overview.totalOrders} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    今日 +{overview.todayOrders}
                  </Typography.Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="成交金额(元)" value={overview.totalSales / 100} precision={2} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    今日 ¥{centToYuan(overview.todaySales)}
                  </Typography.Text>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Card title="订单状态分布" styles={{ body: { minHeight: 260 } }}>
                  {overview.orderStatus.length === 0 ? (
                    <Empty description="暂无数据" />
                  ) : (
                    overview.orderStatus.map((s) => {
                      const percent = overview.totalOrders
                        ? Math.round((s.count / overview.totalOrders) * 100)
                        : 0;
                      return (
                        <div key={s.status} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <span>{ORDER_STATUS[s.status]?.text ?? s.status}</span>
                            <span style={{ color: '#999' }}>
                              {s.count} 单 · {percent}%
                            </span>
                          </div>
                          <Progress
                            percent={percent}
                            showInfo={false}
                            strokeColor={STATUS_BAR_COLOR[s.status] ?? '#1677ff'}
                          />
                        </div>
                      );
                    })
                  )}
                </Card>
              </Col>

              <Col span={16}>
                <Card title="近 7 天成交趋势" styles={{ body: { minHeight: 260 } }}>
                  {overview.salesTrend.every((t) => t.salesAmount === 0) ? (
                    <Empty description="暂无数据" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220 }}>
                      {overview.salesTrend.map((t) => (
                        <div key={t.date} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>
                            {t.salesAmount > 0 ? `¥${centToYuan(t.salesAmount)}` : ''}
                          </div>
                          <div
                            title={`${t.date}：${t.orderCount} 单 / ¥${centToYuan(t.salesAmount)}`}
                            style={{
                              height: Math.max(4, Math.round((t.salesAmount / maxAmount) * 140)),
                              maxWidth: 36,
                              margin: '0 auto',
                              background: '#1677ff',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height .3s',
                            }}
                          />
                          <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{t.date}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            <Card title="热销商品 TOP10" style={{ marginTop: 16 }}>
              <Table
                rowKey="productId"
                size="middle"
                dataSource={overview.hotProducts}
                columns={hotColumns}
                pagination={false}
                locale={{ emptyText: '暂无数据' }}
              />
            </Card>
          </>
        )
      )}
    </Spin>
  );
}
