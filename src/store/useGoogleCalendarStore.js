import { create } from "zustand";

/**
 * useGoogleCalendarStore - Manages Google Calendar Events and Tasks
 * 
 * BUG FIX #3: JSON Fetch Error Resolution
 * Since backend API is not yet implemented, this store uses Mock Data
 * to simulate events and tasks. Replace fetchEventsAndTasks with real API calls
 * once backend endpoints are ready (POST /api/calendar/events, GET /api/calendar/tasks, etc.)
 */

/* ── Mock Data for Development ── */
const MOCK_EVENTS = [
	{
		id: "evt1",
		title: "Team Standup",
		date: "2026-03-27",
		startTime: "09:00",
		endTime: "09:30",
		location: "Meeting Room A",
		description: "Daily standup meeting with the team",
	},
	{
		id: "evt2",
		title: "Client Call",
		date: "2026-03-27",
		startTime: "14:00",
		endTime: "15:00",
		location: "Zoom",
		description: "Q2 planning discussion",
	},
	{
		id: "evt3",
		title: "Project Review",
		date: "2026-03-28",
		startTime: "15:30",
		endTime: "16:30",
		location: "Conference Room B",
		description: "Calendar feature review",
	},
];

const MOCK_TASKS = [
	{
		id: "task1",
		title: "Finish API implementation",
		date: "2026-03-27",
		startTime: "17:00",
		endTime: "18:00",
		description: "Complete Google Calendar API integration",
		completed: false,
	},
	{
		id: "task2",
		title: "Code review",
		date: "2026-03-27",
		startTime: "18:00",
		endTime: "19:00",
		description: "Review pull request #42",
		completed: false,
	},
	{
		id: "task3",
		title: "Update documentation",
		date: "2026-03-28",
		startTime: "12:00",
		endTime: "13:00",
		description: "Add API endpoint docs",
		completed: true,
	},
];

export const useGoogleCalendarStore = create((set, get) => ({
	/* State */
	events: [],
	tasks: [],
	selectedDate: null,
	loading: false,
	error: null,
	pinAuthenticated: false,
	
	/* Actions */
	
	/**
	 * Set the selected date (NO filtering - store always has all data)
	 * 
	 * PHASE 14 FIX: Removed date-based fetching from setSelectedDate.
	 * Data is now fetched once at app init with fetchEventsAndTasks().
	 */
	setSelectedDate: (dateStr) => {
		set({ selectedDate: dateStr });
	},

	/**
	 * Fetch ALL events and tasks (not filtered by date)
	 * 
	 * This loads the complete dataset so calendar dot indicators can show
	 * whether any date has events/tasks without needing to select that date.
	 * 
	 * PHASE 14 FIX: Changed from date-specific fetching to loading all data upfront.
	 * This ensures events/tasks dots are always visible on the calendar.
	 */
	fetchEventsAndTasks: async () => {
		set({ loading: true, error: null });
		
		// Simulate network delay
		await new Promise(resolve => setTimeout(resolve, 300));
		
		try {
			// Load ALL events and tasks (no date filtering)
			// In production, this would call the backend API
			set({
				events: MOCK_EVENTS,
				tasks: MOCK_TASKS,
				loading: false,
				error: null,
			});
		} catch (err) {
			set({
				error: err.message,
				loading: false,
				events: [],
				tasks: [],
			});
		}
	},

	/**
	 * Add a new event (Mock implementation)
	 * 
	 * When backend is ready, replace with:
	 * const response = await fetch("/api/calendar/events", {
	 *   method: "POST",
	 *   headers: { "Content-Type": "application/json" },
	 *   body: JSON.stringify(eventData),
	 * });
	 */
	addEvent: async (eventData) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const newEvent = {
				id: `evt_${Date.now()}`,
				...eventData,
			};
			
			set((state) => ({
				events: [...state.events, newEvent],
				loading: false,
			}));
			return newEvent;
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Add a new task (Mock implementation)
	 */
	addTask: async (taskData) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			const newTask = {
				id: `task_${Date.now()}`,
				...taskData,
				completed: false,
			};
			
			set((state) => ({
				tasks: [...state.tasks, newTask],
				loading: false,
			}));
			return newTask;
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Update an existing event (Mock implementation)
	 */
	updateEvent: async (eventId, updates) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			set((state) => ({
				events: state.events.map((e) =>
					e.id === eventId ? { ...e, ...updates } : e
				),
				loading: false,
			}));
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Update an existing task (Mock implementation)
	 */
	updateTask: async (taskId, updates) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			set((state) => ({
				tasks: state.tasks.map((t) =>
					t.id === taskId ? { ...t, ...updates } : t
				),
				loading: false,
			}));
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Delete an event (Mock implementation)
	 */
	deleteEvent: async (eventId) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			set((state) => ({
				events: state.events.filter((e) => e.id !== eventId),
				loading: false,
			}));
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Delete a task (Mock implementation)
	 */
	deleteTask: async (taskId) => {
		set({ loading: true, error: null });
		try {
			// Simulate network delay
			await new Promise(resolve => setTimeout(resolve, 200));
			
			set((state) => ({
				tasks: state.tasks.filter((t) => t.id !== taskId),
				loading: false,
			}));
		} catch (err) {
			set({
				error: err.message,
				loading: false,
			});
			throw err;
		}
	},

	/**
	 * Clear all events and tasks
	 */
	clearData: () => {
		set({
			events: [],
			tasks: [],
			selectedDate: null,
			error: null,
		});
	},

	/**
	 * Set PIN authenticated state
	 */
	setPinAuthenticated: (isAuthenticated) => {
		set({ pinAuthenticated: isAuthenticated });
	},
}));
