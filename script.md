# Demo Script — Widgets, Smart Widgets, User Settings

## INTRO
Alright, my section covers the widget system, smart widgets, and user settings — everything you interact with once you're logged in.

## PART 1: Default Widgets

So on the right side of the dashboard you've got five default widgets — Weather, Stocks, News, Trending Topics, and Health.
Each one is pulling live data, but they all follow the same architecture underneath.
Rather than calling external APIs directly from the browser, every widget routes its request through a Supabase Edge Function. The edge function is the one that talks to the actual third-party API — OpenWeatherMap for weather, Tavily for news and trends, a stocks endpoint for market data, and Google Fit for health. This keeps API keys off the client and gives us a single layer to handle caching.
[Point to widgets on screen]
The cache is access-time based — if you opened the app within the last 6 hours, you get cached data from Supabase without hitting the external APIs again. If it's been longer, everything re-fetches fresh on load.

[Open Settings → Widgets tab]

Now on the control side — in the Widgets tab you can toggle any widget on or off, and drag to reorder.
[Drag a widget]
The dashboard builds its render list by iterating over a priority array stored in the settings store. So the order here maps directly to what you see on screen — and it's synced to Supabase, so it persists across devices and sessions.
Individual widgets also have their own per-widget settings. Let me click the gear on News.
[Click gear on News widget]
You can switch view modes — text, card, or grid. This is stored separately from the global config, so it's per-widget.
[Close]

## PART 2: Smart Widgets

Now the feature that goes beyond static data — Smart Widgets.
These two here are already loaded — Super Mario Galaxy Movie and laptop. The idea is: instead of searching and getting a flat list of links, you give it a topic and it builds a structured, categorized information panel around it with live content.
[Point to Super Mario Galaxy Movie widget]
Here's the pipeline. When you add a keyword, three things happen in sequence.
First — category classification. The keyword goes through Groq with a rule-based fallback. It classifies the topic into a parent category — Entertainment, Gaming, Technology, Food, and so on. For Super Mario Galaxy Movie it lands on Entertainment. This step matters because the same word can mean completely different things in different contexts.
Second — section plan generation. Based on that parent category, a set of subcategories is constructed — things like Key Info, Reviews and Reactions, Videos, Blogs for Entertainment. These are not hardcoded per keyword. They're determined by category type, so the system scales to any topic without special-casing anything.
Third — live retrieval. Each subcategory fires a Tavily API call through the edge function, pulls real articles and links, and then Groq summarizes the results into what you see here.
[Scroll through sections]
The structure mirrors how you'd actually research a topic — factual anchors first, then reactions, then media and deeper coverage.
[Show category button, timestamp, refresh]
The category can also be manually overridden with this button if the auto-classification misses. And there's a timestamp and refresh so you always know how fresh the data is. The cache is keyed by keyword and language — switching to Korean re-fetches in Korean without touching the English cache.

[Switch to laptop widget]
Now look at laptop — same pipeline, completely different output.
[Scroll]
Because it classifies under Technology, the subcategories shift entirely — Specs, Buying Guides, Reviews. Same engine, context does the rest.
[Gesture at both widgets]
Each smart widget is independently managed, independently cached, and sits alongside your default widgets in the same priority order.

## PART 3: User Settings

[Bottom-right button → Settings]
Three tabs — Widgets, Interests, Diary.
[Widgets tab — gesture]
Widgets we already covered.
[Click Interests tab]
Interests — as you use the app, keywords and topics you engage with get stored here as user interests. You can also manually add fixed categories like Sports or Tech. These feed into the AI Briefing Widget, which is the next section.
[Click Diary tab]
Diary — language setting for entries, and PIN lock. Lock timing ranges from immediate to 6 hours, so you control how long your diary stays unlocked after you access it. That full flow is in the next section.

## HANDOFF
So — default widgets pulling live data through edge functions with access-time caching, smart widgets running a classify-then-retrieve pipeline on any topic, and a settings layer that controls all of it. Passing it over for Briefing and Diary.
