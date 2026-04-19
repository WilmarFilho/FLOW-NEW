import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import crypto from 'node:crypto';

type EvolutionNode = {
  id: string;
  url: string;
};

@Injectable()
export class EvolutionRoutingService implements OnModuleDestroy {
  private readonly logger = new Logger(EvolutionRoutingService.name);
  private readonly redisKeyPrefix = 'flow:evolution:instance-node';
  private readonly redis: Redis | null;
  private readonly nodes: EvolutionNode[];

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://redis:6379/1';
    const routingDb =
      Number(this.configService.get<string>('REDIS_EVOLUTION_ROUTING_DB')) || 2;

    this.redis = this.createRedisClient(redisUrl, routingDb);
    this.nodes = this.loadNodes();

    if (!this.nodes.length) {
      this.logger.warn(
        'Nenhum node de Evolution configurado. O roteamento por shard ficará indisponível.',
      );
    } else {
      this.logger.log(
        `Evolution routing ativo com ${this.nodes.length} node(s): ${this.nodes.map((node) => node.id).join(', ')}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async getBaseUrlForInstance(instanceName: string) {
    const assignedNode = await this.getAssignedNode(instanceName);
    return assignedNode?.url || this.getNodeByHash(instanceName)?.url || null;
  }

  async registerInstance(instanceName: string) {
    const node = this.getNodeByHash(instanceName);
    if (!node) {
      return null;
    }

    await this.setAssignedNode(instanceName, node.id);
    return node;
  }

  async unregisterInstance(instanceName: string) {
    if (!this.redis) {
      return;
    }

    await this.redis.del(this.getRedisKey(instanceName));
  }

  async getAssignedNode(instanceName: string) {
    const assignedNodeId = await this.getAssignedNodeId(instanceName);
    if (assignedNodeId) {
      const assignedNode = this.nodes.find((node) => node.id === assignedNodeId);
      if (assignedNode) {
        return assignedNode;
      }
    }

    return null;
  }

  private createRedisClient(redisUrl: string, db: number) {
    try {
      return new Redis(redisUrl, {
        db,
        lazyConnect: false,
        maxRetriesPerRequest: 1,
      });
    } catch (error) {
      this.logger.warn(`Falha ao inicializar Redis de roteamento: ${String(error)}`);
      return null;
    }
  }

  private loadNodes() {
    const rawNodeUrls = (
      this.configService.get<string>('EVOLUTION_NODE_URLS') ||
      this.configService.get<string>('EVOLUTION_API_URL') ||
      ''
    )
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    return rawNodeUrls.map((entry, index) => {
      const [rawId, rawUrl] = entry.includes('|')
        ? entry.split('|', 2)
        : [`node-${index + 1}`, entry];

      return {
        id: rawId.trim() || `node-${index + 1}`,
        url: rawUrl.trim().replace(/\/+$/, ''),
      };
    });
  }

  private getNodeByHash(instanceName: string) {
    if (!this.nodes.length) {
      return null;
    }

    const hash = crypto.createHash('sha256').update(instanceName).digest();
    const shardIndex = hash.readUInt32BE(0) % this.nodes.length;
    return this.nodes[shardIndex];
  }

  private async getAssignedNodeId(instanceName: string) {
    if (!this.redis) {
      return null;
    }

    try {
      return await this.redis.get(this.getRedisKey(instanceName));
    } catch (error) {
      this.logger.warn(
        `Falha ao buscar shard da instance ${instanceName}: ${String(error)}`,
      );
      return null;
    }
  }

  private async setAssignedNode(instanceName: string, nodeId: string) {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(this.getRedisKey(instanceName), nodeId);
    } catch (error) {
      this.logger.warn(
        `Falha ao persistir shard da instance ${instanceName}: ${String(error)}`,
      );
    }
  }

  private getRedisKey(instanceName: string) {
    return `${this.redisKeyPrefix}:${instanceName}`;
  }
}
