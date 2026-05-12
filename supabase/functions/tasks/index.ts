import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers":
		"authorization, x-client-info, apikey, content-type",
};

const TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1";
const DEFAULT_TASKLIST_ID = "@default";

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: {
			...corsHeaders,
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});

const taskPath = (taskListId = DEFAULT_TASKLIST_ID, taskId = "") => {
	const encodedListId = encodeURIComponent(taskListId || DEFAULT_TASKLIST_ID);
	const encodedTaskId = taskId ? `/${encodeURIComponent(taskId)}` : "";
	return `/lists/${encodedListId}/tasks${encodedTaskId}`;
};

const googleFetch = async (
	token: string,
	path: string,
	init: RequestInit = {},
) => {
	const headers = new Headers(init.headers || {});
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("Content-Type", "application/json");

	const response = await fetch(`${TASKS_BASE_URL}${path}`, {
		...init,
		headers,
	});

	if (!response.ok) {
		throw new Error(`Google Tasks ${response.status}: ${await response.text()}`);
	}

	if (response.status === 204) {
		return null;
	}

	return await response.json();
};

const formatTask = (task: any, taskListId = DEFAULT_TASKLIST_ID) => ({
	id: task.id,
	taskListId,
	title: task.title || "",
	notes: task.notes || "",
	due: task.due || null,
	status: task.status || "needsAction",
	completed: task.status === "completed",
	completedAt: task.completed || null,
	updated: task.updated || null,
	hidden: !!task.hidden,
	deleted: !!task.deleted,
});

const formatTaskList = (list: any) => ({
	id: list.id,
	title: list.title || "",
	updated: list.updated || null,
});

const listTaskLists = async (token: string) => {
	const items: any[] = [];
	let pageToken = "";

	do {
		const params = new URLSearchParams({ maxResults: "100" });
		if (pageToken) params.set("pageToken", pageToken);

		const response = await googleFetch(token, `/users/@me/lists?${params.toString()}`);
		items.push(...(response?.items || []));
		pageToken = response?.nextPageToken || "";
	} while (pageToken);

	return items.map((list: any) => formatTaskList(list));
};

const listTasksForTaskList = async (
	token: string,
	taskListId: string,
	options: Record<string, unknown> = {},
) => {
	const items: any[] = [];
	let pageToken = "";

	do {
		const params = new URLSearchParams({
			showCompleted: String(options.showCompleted ?? true),
			showHidden: String(options.showHidden ?? true),
			maxResults: "100",
		});
		if (pageToken) params.set("pageToken", pageToken);

		const response = await googleFetch(
			token,
			`${taskPath(taskListId)}?${params.toString()}`,
		);
		items.push(...(response?.items || []));
		pageToken = response?.nextPageToken || "";
	} while (pageToken);

	return items;
};

serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response("ok", { headers: corsHeaders });
	}

	const authHeader = req.headers.get("Authorization") ?? "";
	const jwt = authHeader.replace("Bearer ", "");
	const supabase = createClient(
		Deno.env.get("SUPABASE_URL")!,
		Deno.env.get("SUPABASE_ANON_KEY")!,
	);
	const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
	if (authError || !user) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const { token } = body;
		const action = body.action || "list";
		const taskListId = body.taskListId || DEFAULT_TASKLIST_ID;
		if (!token) throw new Error("Google OAuth token required");

		if (action === "create") {
			const created = await googleFetch(token, taskPath(taskListId), {
				method: "POST",
				body: JSON.stringify({
					title: body.title,
					notes: body.notes,
					due: body.due,
					status: body.status || "needsAction",
					completed: body.completed ?? null,
				}),
			});
			return json(formatTask(created, taskListId));
		}

		if (action === "update") {
			const taskId = String(body.taskId || "").trim();
			if (!taskId) throw new Error("taskId is required for update");

			const updated = await googleFetch(token, taskPath(taskListId, taskId), {
				method: "PUT",
				body: JSON.stringify({
					id: taskId,
					title: body.title,
					notes: body.notes,
					due: body.due,
					status: body.status,
					completed: body.completed ?? null,
				}),
			});
			return json(formatTask(updated, taskListId));
		}

		if (action === "delete") {
			const taskId = String(body.taskId || "").trim();
			if (!taskId) throw new Error("taskId is required for delete");

			await googleFetch(token, taskPath(taskListId, taskId), {
				method: "DELETE",
			});
			return json({ success: true, id: taskId });
		}

		if (action === "listTaskLists") {
			return json(await listTaskLists(token));
		}

		if (action === "createTaskList") {
			const title = String(body.title || "").trim();
			if (!title) throw new Error("title is required for createTaskList");

			const created = await googleFetch(token, "/users/@me/lists", {
				method: "POST",
				body: JSON.stringify({ title }),
			});
			return json(formatTaskList(created));
		}

		if (action === "move") {
			const taskId = String(body.taskId || "").trim();
			const sourceTaskListId = String(
				body.sourceTaskListId || DEFAULT_TASKLIST_ID,
			).trim();
			const destinationTaskListId = String(
				body.destinationTaskListId || DEFAULT_TASKLIST_ID,
			).trim();
			if (!taskId) throw new Error("taskId is required for move");

			const params = new URLSearchParams({
				destinationTasklist: destinationTaskListId,
			});
			const moved = await googleFetch(
				token,
				`${taskPath(sourceTaskListId, taskId)}/move?${params.toString()}`,
				{ method: "POST" },
			);
			return json(formatTask(moved, destinationTaskListId));
		}

		if (action === "clearCompleted") {
			await googleFetch(
				token,
				`/lists/${encodeURIComponent(taskListId || DEFAULT_TASKLIST_ID)}/clear`,
				{ method: "POST", body: "{}" },
			);
			return json({ success: true });
		}

		if (body.allTaskLists) {
			const taskLists = await listTaskLists(token);
			const tasksByList = await Promise.all(
				taskLists.map(async (list: any) => {
					const items = await listTasksForTaskList(token, list.id, body);
					return items.map((item) => formatTask(item, list.id));
				}),
			);
			return json(tasksByList.flat());
		}

		const items = await listTasksForTaskList(token, taskListId, body);

		return json(items.map((item) => formatTask(item, taskListId)));
	} catch (e) {
		return json({ error: e.message }, { status: 400 });
	}
});
