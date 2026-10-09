import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 封装：refreshToken 存取（登出失效 / 刷新轮换）+ 通用缓存（getJSON/setJSON/tryDel）。
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** 读缓存对象：JSON 反序列化；读失败/缺失按 miss 处理（返回 null，走数据库） */
  async getJSON<T = any>(key: string): Promise<T | null> {
    try {
      const raw = await this.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  /** 写缓存对象：JSON 序列化；失败仅告警不阻断主流程（一致性靠 TTL 兜底） */
  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      await this.set(key, JSON.stringify(value), ttlSeconds);
    } catch (e) {
      console.warn('[redis] 缓存写入失败，忽略（由 TTL 兜底）:', e);
    }
  }

  /** 尽力删除：缓存失效是尽力而为，失败不抛错（漏删由 TTL 兜底） */
  async tryDel(key: string): Promise<void> {
    try {
      await this.del(key);
    } catch (e) {
      console.warn('[redis] 缓存删除失败，忽略（由 TTL 兜底）:', e);
    }
  }

  /** 仅当 key 不存在时写入（返回是否写入成功，用于初始化默认值，如秒杀库存） */
  async setNX(key: string, value: string): Promise<boolean> {
    const res = await this.client.set(key, value, 'NX');
    return res === 'OK';
  }

  /** 执行 Lua 脚本（原子操作，秒杀预扣等并发场景用） */
  async evalScript(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    return this.client.eval(script, keys.length, ...keys, ...args);
  }
}
