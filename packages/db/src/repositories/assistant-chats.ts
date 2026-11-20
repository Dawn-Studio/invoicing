import { desc, eq } from "drizzle-orm";
import { assistantChats } from "../schema";
import { notFound, type RepositoryContext } from "./context";

export interface AssistantChatSummary {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
}

export interface AssistantChat extends AssistantChatSummary {
	/** AI SDK UI messages; validated by the app, which knows their shape. */
	messages: unknown[];
}

/** Conversations with the assistant, newest first. */
export function assistantChatRepository({ db, now }: RepositoryContext) {
	const find = (id: string): AssistantChat | null =>
		db.select().from(assistantChats).where(eq(assistantChats.id, id)).get() ?? null;

	return {
		list(limit = 100): AssistantChatSummary[] {
			return db
				.select({
					id: assistantChats.id,
					title: assistantChats.title,
					createdAt: assistantChats.createdAt,
					updatedAt: assistantChats.updatedAt,
				})
				.from(assistantChats)
				.orderBy(desc(assistantChats.updatedAt))
				.limit(limit)
				.all();
		},

		find,

		get(id: string): AssistantChat {
			return find(id) ?? notFound("Conversation");
		},

		/** Creates the chat on its first save; keeps the first title it was given. */
		save(id: string, { title, messages }: { title: string; messages: unknown[] }): AssistantChat {
			const timestamp = now();
			return db
				.insert(assistantChats)
				.values({ id, title, messages, createdAt: timestamp, updatedAt: timestamp })
				.onConflictDoUpdate({
					target: assistantChats.id,
					set: { messages, updatedAt: timestamp },
				})
				.returning()
				.get();
		},

		rename(id: string, title: string): AssistantChat {
			return (
				db
					.update(assistantChats)
					.set({ title, updatedAt: now() })
					.where(eq(assistantChats.id, id))
					.returning()
					.get() ?? notFound("Conversation")
			);
		},

		delete(id: string): void {
			db.delete(assistantChats).where(eq(assistantChats.id, id)).run();
		},

		deleteAll(): void {
			db.delete(assistantChats).run();
		},
	};
}
