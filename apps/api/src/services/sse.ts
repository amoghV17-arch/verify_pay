import type { FastifyReply } from 'fastify';

export interface SseClient {
  id: string;
  projectId: string;
  reply: FastifyReply;
}

export class SseHub {
  private clients = new Map<string, Set<SseClient>>();

  subscribe(projectId: string, client: SseClient): () => void {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    const set = this.clients.get(projectId)!;
    set.add(client);

    return () => {
      set.delete(client);
      if (set.size === 0) {
        this.clients.delete(projectId);
      }
    };
  }

  broadcast(projectId: string, eventName: string, data: unknown, id?: string): void {
    const set = this.clients.get(projectId);
    if (!set || set.size === 0) return;

    const eventId = id || Date.now().toString();
    const payload = `event: ${eventName}\nid: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const client of set) {
      try {
        client.reply.raw.write(payload);
      } catch {
        set.delete(client);
      }
    }
  }
}

export const sseHub = new SseHub();

