import { useEffect, useState } from 'react';
import { Button, Dialog, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { deleteAddress, listAddresses } from '../api/trade';
import type { Address } from '../api/trade';
import { getErrorMessage } from '../api/request';

export default function AddressList() {
  const navigate = useNavigate();
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await listAddresses();
      setList(res.data.data);
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const remove = (a: Address) => {
    Dialog.confirm({
      content: '确认删除该地址？',
      onConfirm: async () => {
        try {
          await deleteAddress(a.id);
          Toast.show({ content: '已删除', icon: 'success' });
          await load();
        } catch (e) {
          Toast.show({ content: getErrorMessage(e), icon: 'fail' });
        }
      },
    });
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>地址管理</NavBar>
      {loading ? (
        <div className="empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty">还没有收货地址</div>
      ) : (
        <div className="addr-list">
          {list.map((a) => (
            <div key={a.id} className="addr-card">
              <div className="addr-line">
                <span className="addr-name">{a.receiverName}</span>
                <span>{a.receiverPhone}</span>
                {a.isDefault === 1 && <span className="addr-tag">默认</span>}
              </div>
              <div className="addr-detail">
                {a.province}
                {a.city}
                {a.district}
                {a.detail}
              </div>
              <div className="addr-ops">
                <span onClick={() => navigate(`/address/edit/${a.id}`)}>编辑</span>
                <span className="addr-del" onClick={() => remove(a)}>
                  删除
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="addr-add">
        <Button block color="primary" onClick={() => navigate('/address/edit')}>
          新增地址
        </Button>
      </div>
    </div>
  );
}
