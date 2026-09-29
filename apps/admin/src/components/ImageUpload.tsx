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
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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

  const fileList: UploadFile[] = value.map((url, i) => ({
    uid: url,
    name: `img-${i}`,
    status: 'done',
    url,
  }));

  return (
    <Upload
      listType="picture-card"
      accept="image/*"
      fileList={fileList}
      onChange={({ fileList: fl }) => {
        const urls = fl
          .filter((f) => f.status === 'done')
          .map((f) => ((f.response as { url?: string } | undefined)?.url ?? f.url ?? '') as string)
          .filter(Boolean);
        onChange?.(urls);
      }}
      customRequest={async ({ file, onSuccess, onError }) => {
        try {
          const res = await uploadImage(file as File);
          onSuccess?.({ url: res.data.data.url });
        } catch (e) {
          onError?.(e as Error);
          message.error(getErrorMessage(e));
        }
      }}
    >
      {value.length >= max ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>上传</div>
        </div>
      )}
    </Upload>
  );
}
