import { Card, Typography } from 'antd';
import { useAuth } from '../../store/auth';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <Card>
      <Typography.Title level={4}>欢迎，{user?.nickname}</Typography.Title>
      <Typography.Paragraph type="secondary">
        当前角色：{user?.roles?.join('、') || '-'}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        拥有权限：{user?.permissions?.join('、') || '-'}
      </Typography.Paragraph>
    </Card>
  );
}
