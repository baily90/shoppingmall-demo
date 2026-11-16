import { useState } from 'react';
import { App, Upload } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

/** 单张轮播图卡片：可拖拽排序，右上角删除 */
function SortableImage({ url, onRemove }: { url: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });

  return (
    <div
      ref={setNodeRef}
      className="img-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <img src={url} alt="" />
      <button type="button" className="img-card-remove" aria-label="删除" onClick={onRemove}>
        ×
      </button>
      <span className="img-card-drag" {...attributes} {...listeners}>
        ⠿ 拖拽
      </span>
    </div>
  );
}

/** 多图上传（商品轮播图）：value 为 url 数组，支持拖拽调整顺序 */
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // 拖拽结束：把 active 项移到 over 项的位置
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = value.indexOf(active.id as string);
    const newIndex = value.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange?.(arrayMove(value, oldIndex, newIndex));
  };

  const handleRemove = (url: string) => {
    onChange?.(value.filter((u) => u !== url));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={value} strategy={rectSortingStrategy}>
        <div className="multi-img-grid">
          {value.map((url) => (
            <SortableImage key={url} url={url} onRemove={() => handleRemove(url)} />
          ))}

          {value.length < max && (
            <Upload
              listType="picture-card"
              showUploadList={false}
              accept="image/*"
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
              <div>
                {loading ? <LoadingOutlined /> : <PlusOutlined />}
                <div style={{ marginTop: 8 }}>上传</div>
              </div>
            </Upload>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
