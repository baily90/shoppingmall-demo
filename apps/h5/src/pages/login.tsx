import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, NavBar, Toast } from 'antd-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { resetPassword } from '../api/user';
import { getErrorMessage } from '../api/request';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Mode = 'login' | 'register' | 'forgot';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  // 登录前的目标路由（由 RequireAuth / 详情页跳转时携带）
  const from = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Toast.show({ content: '手机号格式不正确', icon: 'fail' });
      return;
    }
    if (password.length < 6) {
      Toast.show({ content: '密码至少 6 位', icon: 'fail' });
      return;
    }
    if (mode === 'forgot' && password !== confirmPassword) {
      Toast.show({ content: '两次输入的密码不一致', icon: 'fail' });
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(phone, password);
      } else if (mode === 'register') {
        await register(phone, password, nickname || undefined);
      } else {
        await resetPassword(phone, password);
        Toast.show({ content: '密码重置成功，请登录', icon: 'success' });
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }
      Toast.show({ content: mode === 'login' ? '登录成功' : '注册成功', icon: 'success' });
      navigate(from ?? '/', { replace: true });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : '重置密码';

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>{title}</NavBar>
      <motion.div
        className="login-form"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="login-title">{title}</div>
        <Input
          placeholder="请输入手机号"
          value={phone}
          onChange={setPhone}
          type="tel"
          maxLength={11}
          className="login-input"
        />
        {mode === 'register' && (
          <Input
            placeholder="昵称（选填）"
            value={nickname}
            onChange={setNickname}
            maxLength={30}
            className="login-input"
          />
        )}
        <Input
          placeholder={mode === 'forgot' ? '请输入新密码（至少 6 位）' : '请输入密码（至少 6 位）'}
          value={password}
          onChange={setPassword}
          type="password"
          maxLength={20}
          className="login-input"
        />
        {mode === 'forgot' && (
          <Input
            placeholder="请再次输入新密码"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            maxLength={20}
            className="login-input"
          />
        )}
        {mode === 'login' && (
          <div className="login-forgot" onClick={() => setMode('forgot')}>
            忘记密码？
          </div>
        )}
        <Button block color="primary" size="large" loading={loading} onClick={() => void submit()}>
          {mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码'}
        </Button>
        <div
          className="login-toggle"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login'
            ? '没有账号？去注册'
            : mode === 'register'
              ? '已有账号？去登录'
              : '想起密码？去登录'}
        </div>
      </motion.div>
    </div>
  );
}
