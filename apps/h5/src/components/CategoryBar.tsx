import type { CategoryNode } from '../api/store';

/**
 * 两级分类栏：
 * - 第一行：全部 + 一级分类
 * - 第二行：当前一级分类有子分类时显示，「全部 + 子分类…」，
 *   其中「全部」= 该一级分类下所有商品（默认选中）
 */
export default function CategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: CategoryNode[];
  activeId?: number;
  onSelect: (id?: number) => void;
}) {
  // 当前激活的一级分类：activeId 本身是一级，或 activeId 属于某个一级的子分类
  const activeParent =
    categories.find((p) => p.id === activeId) ??
    categories.find((p) => p.children.some((c) => c.id === activeId));

  const children = activeParent?.children ?? [];

  return (
    <div>
      <div className="category-bar">
        <div
          className={activeId == null ? 'category-chip active' : 'category-chip'}
          onClick={() => onSelect()}
        >
          全部
        </div>
        {categories.map((p) => (
          <div
            key={p.id}
            className={activeParent?.id === p.id ? 'category-chip active' : 'category-chip'}
            onClick={() => onSelect(p.id)}
          >
            {p.name}
          </div>
        ))}
      </div>
      {activeParent && children.length > 0 && (
        <div className="category-bar category-sub-bar">
          <div
            className={activeId === activeParent.id ? 'category-chip active' : 'category-chip'}
            onClick={() => onSelect(activeParent.id)}
          >
            全部
          </div>
          {children.map((c) => (
            <div
              key={c.id}
              className={activeId === c.id ? 'category-chip active' : 'category-chip'}
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
