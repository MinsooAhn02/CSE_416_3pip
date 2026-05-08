# MorningBriefing.AI

## 🚩 Problem Statement
In the modern information age, individuals are overwhelmed by a constant flood of news, trends, and data from countless sources. Rather than staying informed, many people experience "information fatigue", a state in which the sheer volume of content makes it difficult to distinguish what is relevant, reliable, or truthful.

Despite this overload, the world continues to demand that people stay aware of current events, economic shifts, and daily lifestyle factors. Busy professionals and students, in particular, lack a simple, unified tool to receive the information that actually matters to them, without sorting through noise.

## ✅ Solutions
MorningBriefing.AI completely eliminates the need for users to search for information through a "New Tab Dashboard" that automatically appears every time they open their browser.

- Ultra-Integral Accessibility: Simply opening a new tab instantly launches the briefing, without requiring any additional service access.

- Intelligent Data Integration and Analysis: By combining the user's real-time status (sleep, schedule, activity level) collected through Google Fit and Calendar APIs with external indicators (stocks, prices, weather), MorningBriefing.AI delivers a personal assistant-like briefing with context, not a simple list.

- Custom Widget Layout: Instead of a fixed screen, MorningBriefing.AI minimizes visual fatigue by providing a personalized dashboard and widget layout optimized for the user's interests (investment, exercise, homework).

- Note: This is a frontend-focused Chrome extension that integrates with external services

## Technology Stack

### Frontend
- Language: JavaScript (JSX)
- Framework: React 18.3.1
- Build Tool: Vite 6.0.0
- Styling: Tailwind CSS 3.4.17
- State Management: Zustand 5.0.11
- UI Components: Lucide React (icons), React Grid Layout (widget positioning)

### Backend
- Architecture: Hybrid (Serverless API Integration + Managed Backend)
- Runtime: Python 3.11+
- Framework: FastAPI
- Database & Auth: Supabase (PostgreSQL, Row-Level Security, OAuth integration)
- AI SDK: Google AI Studio (Gemini API)
- External APIs: Google Fit API, Google Calendar API, Weather API, Stock Market API, News API
- Authentication: Google OAuth 2.0, Supabase Auth

### 👥 Team Members
- Ahn Minsoo — Infrastructure & DevOps
- Choo Sungmin — Backend Developer
- Kwon Dahyun — Frontend Developer & UI/UX Designer

### 📋 Project Management
This project is managed using Jira.

- Scrum Board: [Jira Board](https://stonybrook-team-3pip.atlassian.net/jira/software/projects/SCRUM/boards/1?atlOrigin=eyJpIjoiNTI4OTI0MWU4ZDIwNDJhNmFhYmU1OWM0MmNjYmZkNjQiLCJwIjoiaiJ9)
