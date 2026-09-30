import { Button, List, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import BottomTabBar from '../components/TabBar';

export default function Mine() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const doLogout = async () => {
    await logout();
    Toast.show({ content: '已退出登录', icon: 'success' });
    navigate('/');
  };

  return (
    <div className="page tab-page">
      <NavBar>我的</NavBar>
      <div className="mine-head">
        {user ? (
          <>
            <div className="mine-avatar">{user.nickname.slice(0, 1)}</div>
            <div>
              <div className="mine-name">{user.nickname}</div>
              <div className="mine-phone">{user.phone}</div>
            </div>
          </>
        ) : (
          <div className="mine-guest">
            <span>未登录</span>
            <Button size="small" color="primary" onClick={() => navigate('/login')}>
              去登录
            </Button>
          </div>
        )}
      </div>
      <List className="mine-menu">
        <List.Item onClick={() => navigate('/orders')}>我的订单</List.Item>
        <List.Item onClick={() => navigate('/address')}>地址管理</List.Item>
      </List>
      {user && (
        <div className="mine-logout">
          <Button block color="danger" onClick={() => void doLogout()}>
            退出登录
          </Button>
        </div>
      )}
      <BottomTabBar />
    </div>
  );
}
