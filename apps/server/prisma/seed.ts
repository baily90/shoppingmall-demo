import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface PermDef {
  code: string;
  name: string;
  type: number;
  path?: string;
  icon?: string;
  sort?: number;
  children?: PermDef[];
}

/** 权限树（type：1 目录 / 2 菜单 / 3 按钮），code 为 <模块>:<动作> */
const permissionDefs: PermDef[] = [
  {
    code: 'system',
    name: '系统管理',
    type: 1,
    path: '/system',
    icon: 'SettingOutlined',
    sort: 1,
    children: [
      {
        code: 'user:list',
        name: '用户管理',
        type: 2,
        path: '/system/user',
        icon: 'UserOutlined',
        sort: 1,
        children: [
          { code: 'user:create', name: '新增用户', type: 3, sort: 1 },
          { code: 'user:update', name: '编辑用户', type: 3, sort: 2 },
          { code: 'user:delete', name: '删除用户', type: 3, sort: 3 },
          { code: 'user:assign-role', name: '分配角色', type: 3, sort: 4 },
        ],
      },
      {
        code: 'role:list',
        name: '角色管理',
        type: 2,
        path: '/system/role',
        icon: 'TeamOutlined',
        sort: 2,
        children: [
          { code: 'role:create', name: '新增角色', type: 3, sort: 1 },
          { code: 'role:update', name: '编辑角色', type: 3, sort: 2 },
          { code: 'role:delete', name: '删除角色', type: 3, sort: 3 },
          { code: 'role:assign-permission', name: '分配权限', type: 3, sort: 4 },
        ],
      },
      {
        code: 'permission:list',
        name: '权限管理',
        type: 2,
        path: '/system/permission',
        icon: 'SafetyCertificateOutlined',
        sort: 3,
        children: [
          { code: 'permission:create', name: '新增权限', type: 3, sort: 1 },
          { code: 'permission:update', name: '编辑权限', type: 3, sort: 2 },
          { code: 'permission:delete', name: '删除权限', type: 3, sort: 3 },
        ],
      },
    ],
  },
  {
    code: 'product',
    name: '商品管理',
    type: 1,
    path: '/product',
    icon: 'ShoppingOutlined',
    sort: 2,
    children: [
      {
        code: 'category:list',
        name: '分类管理',
        type: 2,
        path: '/product/category',
        icon: 'AppstoreOutlined',
        sort: 1,
        children: [
          { code: 'category:create', name: '新增分类', type: 3, sort: 1 },
          { code: 'category:update', name: '编辑分类', type: 3, sort: 2 },
          { code: 'category:delete', name: '删除分类', type: 3, sort: 3 },
        ],
      },
      {
        code: 'brand:list',
        name: '品牌管理',
        type: 2,
        path: '/product/brand',
        icon: 'TagsOutlined',
        sort: 2,
        children: [
          { code: 'brand:create', name: '新增品牌', type: 3, sort: 1 },
          { code: 'brand:update', name: '编辑品牌', type: 3, sort: 2 },
          { code: 'brand:delete', name: '删除品牌', type: 3, sort: 3 },
        ],
      },
      {
        code: 'product:list',
        name: '商品管理',
        type: 2,
        path: '/product/product',
        icon: 'ShoppingCartOutlined',
        sort: 3,
        children: [
          { code: 'product:create', name: '新增商品', type: 3, sort: 1 },
          { code: 'product:update', name: '编辑商品', type: 3, sort: 2 },
          { code: 'product:delete', name: '删除商品', type: 3, sort: 3 },
        ],
      },
    ],
  },
  {
    code: 'order',
    name: '订单管理',
    type: 1,
    path: '/order',
    icon: 'ProfileOutlined',
    sort: 3,
    children: [
      {
        code: 'order:list',
        name: '订单列表',
        type: 2,
        path: '/order/order',
        icon: 'ProfileOutlined',
        sort: 1,
        children: [{ code: 'order:ship', name: '订单发货', type: 3, sort: 1 }],
      },
    ],
  },
  {
    code: 'marketing',
    name: '营销管理',
    type: 1,
    path: '/marketing',
    icon: 'GiftOutlined',
    sort: 4,
    children: [
      {
        code: 'coupon:list',
        name: '优惠券管理',
        type: 2,
        path: '/marketing/coupon',
        icon: 'GiftOutlined',
        sort: 1,
        children: [
          { code: 'coupon:create', name: '新增优惠券', type: 3, sort: 1 },
          { code: 'coupon:update', name: '编辑优惠券', type: 3, sort: 2 },
          { code: 'coupon:delete', name: '删除优惠券', type: 3, sort: 3 },
        ],
      },
      {
        code: 'seckill:list',
        name: '秒杀活动',
        type: 2,
        path: '/marketing/seckill',
        icon: 'ThunderboltOutlined',
        sort: 2,
        children: [
          { code: 'seckill:create', name: '新增活动', type: 3, sort: 1 },
          { code: 'seckill:update', name: '编辑活动', type: 3, sort: 2 },
          { code: 'seckill:delete', name: '删除活动', type: 3, sort: 3 },
        ],
      },
    ],
  },
];

async function createPermission(
  tx: Prisma.TransactionClient,
  def: PermDef,
  parentId: number | null,
  idByCode: Map<string, number>,
): Promise<void> {
  const created = await tx.permission.create({
    data: {
      code: def.code,
      name: def.name,
      type: def.type,
      path: def.path ?? null,
      icon: def.icon ?? null,
      sort: def.sort ?? 0,
      parentId,
    },
  });
  idByCode.set(def.code, created.id);
  for (const child of def.children ?? []) {
    await createPermission(tx, child, created.id, idByCode);
  }
}

async function main(): Promise<void> {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);

  await prisma.$transaction(async (tx) => {
    // 清空后重建，保证幂等
    await tx.adminUserRole.deleteMany();
    await tx.rolePermission.deleteMany();
    await tx.adminUser.deleteMany();
    await tx.role.deleteMany();
    await tx.permission.deleteMany();

    const idByCode = new Map<string, number>();
    for (const def of permissionDefs) {
      await createPermission(tx, def, null, idByCode);
    }

    const superAdmin = await tx.role.create({
      data: { code: 'super_admin', name: '超级管理员', description: '拥有全部权限', sort: 0 },
    });
    const operator = await tx.role.create({
      data: { code: 'operator', name: '运营', description: '仅用户管理查看', sort: 1 },
    });

    for (const code of idByCode.keys()) {
      await tx.rolePermission.create({
        data: { roleId: superAdmin.id, permissionId: idByCode.get(code)! },
      });
    }
    for (const code of ['system', 'user:list']) {
      await tx.rolePermission.create({
        data: { roleId: operator.id, permissionId: idByCode.get(code)! },
      });
    }

    const admin = await tx.adminUser.create({
      data: { username: 'admin', password: adminPassword, nickname: '超级管理员' },
    });
    const operatorUser = await tx.adminUser.create({
      data: { username: 'operator', password: operatorPassword, nickname: '运营' },
    });

    await tx.adminUserRole.create({ data: { adminUserId: admin.id, roleId: superAdmin.id } });
    await tx.adminUserRole.create({
      data: { adminUserId: operatorUser.id, roleId: operator.id },
    });
  });

  console.log('✅ RBAC 种子数据完成：admin/admin123（超管）、operator/operator123（运营）');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
