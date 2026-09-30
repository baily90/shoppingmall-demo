import { useState } from 'react';
import { App, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { getErrorMessage } from '../api/request';
import { uploadImage } from '../api/product';

/** 单图上传（主图/logo/图标）：点击上传，返回可访问 URL */
export function ImageUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (url: string) => void;
}) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  return (
    <Upload
      listType="picture-card"
      showUploadList={false}
      accept="image/*"
      customRequest={async ({ file, onSuccess, onError }) => {
        setLoading(true);
        try {
          const res = await uploadImage(file as File);
          onChange?.(res.data.data.url);
          onSuccess?.(res.data);
        } catch (e) {
          onError?.(e as Error);
          message.error(getErrorMessage(e));
        } finally {
          setLoading(false);
        }
      }}
    >
      {value ? (
        <img
          src={value}
          alt="upload"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <div>
          {loading ? <LoadingOutlined /> : <PlusOutlined />}
          <div style={{ marginTop: 8 }}>上传</div>
        </div>
      )}
    </Upload>
  );
}

/** 多图上传（商品轮播图）：value 为 url 数组 */
export function MultiImageUpload({
  value = [],
  onChange,
  max = 5,
}: {
  value?: string[];
  onChange?: (urls: string[]) => void;
  max?: number;
}) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // 受控 fileList 直接由 value 派生，新增/删除都显式写回 onChange，
  // 不依赖 antd 内部 fileList 反解 response（受控模式下该链路不可靠）。
  const fileList: UploadFile[] = value.map((url, i) => ({
    uid: `${i}-${url}`,
    name: `img-${i}`,
    status: 'done',
    url,
  }));

  return (
    <Upload
      listType="picture-card"
      accept="image/*"
      fileList={fileList}
      onRemove={(file) => {
        onChange?.(value.filter((u) => u !== file.url));
        return false;
      }}
      customRequest={async ({ file, onSuccess, onError }) => {
        setLoading(true);
        try {
          const res = await uploadImage(file as File);
          onChange?.([...value, res.data.data.url]);
          onSuccess?.(res.data);
        } catch (e) {
          onError?.(e as Error);
          message.error(getErrorMessage(e));
        } finally {
          setLoading(false);
        }
      }}
    >
      {value.length >= max ? null : (
        <div>
          {loading ? <LoadingOutlined /> : <PlusOutlined />}
          <div style={{ marginTop: 8 }}>上传</div>
        </div>
      )}
    </Upload>
  );
}
