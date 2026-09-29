import type { FlatCategory } from '../api/store';

export default function CategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: FlatCategory[];
  activeId?: number;
  onSelect: (id?: number) => void;
}) {
  return (
    <div className="category-bar">
      <div
        className={activeId == null ? 'category-chip active' : 'category-chip'}
        onClick={() => onSelect()}
      >
        全部
      </div>
      {categories.map((c) => (
        <div
          key={c.id}
          className={activeId === c.id ? 'category-chip active' : 'category-chip'}
          style={c.level > 1 ? { paddingLeft: 16, opacity: 0.85 } : undefined}
          onClick={() => onSelect(c.id)}
        >
          {c.level > 1 ? '· ' : ''}
          {c.name}
        </div>
      ))}
    </div>
  );
}
