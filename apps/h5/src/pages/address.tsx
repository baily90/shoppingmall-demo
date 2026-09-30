import { useEffect, useState } from 'react';
import { Button, Dialog, NavBar, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import { deleteAddress, listAddresses, updateAddress } from '../api/trade';
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

  const setDefault = async (a: Address) => {
    try {
      await updateAddress(a.id, { isDefault: 1 });
      // 本地更新：只把默认标志挪到新地址，不重新拉列表（避免默认地址瞬间跳位，像 bug）
      setList((prev) => prev.map((item) => ({ ...item, isDefault: item.id === a.id ? 1 : 0 })));
      Toast.show({ content: '已设为默认', icon: 'success' });
    } catch (e) {
      Toast.show({ content: getErrorMessage(e), icon: 'fail' });
    }
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
                {a.isDefault !== 1 && <span onClick={() => void setDefault(a)}>设为默认</span>}
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
