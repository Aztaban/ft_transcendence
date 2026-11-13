# Browser support

The subject's minor module "Support for additional browsers" (#683). The application is tested in the latest desktop versions of:

| Browser | Engine | Status |
|---|---|---|
| Google Chrome | Blink | Main development browser |
| Mozilla Firefox | Gecko | Supported, tested with the checklist below (Firefox 154) |
| Microsoft Edge | Blink (same as Chrome) | Supported, tested with the checklist below (Edge 157) |

## How it was checked

1. **Code audit** of the frontend for features that behave differently between browsers:
   - **CSS:** `:has()`, `backdrop-filter`, `-webkit-line-clamp`, masks, scrollbars, search fields.
   - **Forms:** native validation bubbles, input types.
   - **Browser APIs:** clipboard, `ResizeObserver`, `matchMedia`, `Intl`.
   - **Build target:** Vite builds for Firefox 78+ and Edge 88+.
2. **Manual test** of every page and workflow in each browser, with the checklist below.

Fixed after the audit:

- **Login form:** used the browser's own "fill out this field" bubble, which looks different in each browser and is shown in the browser's language instead of the app's. The form now checks the fields itself, with a translated message, like the registration form.
- **Search field on the Hitchhikers page:** Chrome and Edge showed their own clear button and Firefox did not. It is hidden everywhere now; the name chip clears the search in every browser.
- **Hitchhikers page at 200 % zoom:** with the sidebar open, a 700px window (a 1400px screen at 200 %) left the page phone-sized, but its narrow layout only started on phone-sized windows: the overview labels were cut off and the project chips stuck out of the cards. The narrow layout now follows the page's own width (a container query), in every browser.

## Known differences (by design, not bugs)

- **The self-signed certificate.** Each browser asks once to accept the certificate of `https://localhost`. The WebSocket (`wss://localhost/ws/`) uses the same exception, so open the page and accept it first, or live updates cannot connect.
- **Native controls.** Dropdowns (`<select>`) keep each browser's own look. The page itself has no scrollbar in any browser (it still scrolls with the wheel, touch and keyboard); inner lists such as the sidebar keep a thin one, in the app's colours in Firefox through `scrollbar-width` and `scrollbar-color`.
- **Network lines in the console.** A request the server refuses on purpose, such as a wrong password (`401 invalid_credentials`, api-plan §10.1), is logged by the browser itself as a network entry. Chrome and Edge show these in the Console by default; Firefox shows them only with the "XHR" / "Requests" filter on. They are not JavaScript errors, and the app shows the user a translated message for each.
- **While the server restarts,** the browser logs each failed WebSocket attempt (Firefox: "can't establish a connection to the server at wss://localhost/ws/"). The app shows "Reconnecting…", tries again and shows "Back online"; these lines stop once it is back.
- **Dates and times** are formatted by the browser (`Intl`). The values are the same everywhere; separators can differ slightly between browsers.
- **Reduced motion** follows the operating system setting in all three browsers: the Home banner then shows a still image.

## Test checklist

**Firefox 154 (13 November 2026):** every row ✅, no JavaScript errors or warnings in the console. The Student, Hitchhiker, Head Tutor, Student Council, live update, accessibility and phone rows were also run automatically in headless Firefox over WebDriver BiDi, with separate student, Hitchhiker and admin accounts; the creation steps of a request, the slot choice and keyboard activation were then checked by hand. Two layout problems found on the way are fixed in #822 (the Hitchhikers page at 200 % zoom, the page scrollbar and the top bar on small phones).

**Microsoft Edge 157 (Linux, 13 November 2026):** every row ✅, tested the same way: the rows before login and the layout by hand, the logged-in rows also automatically in headless Edge over the DevTools protocol. Keyboard activation (Enter on a button) was covered by the automatic run here. The console showed only the expected WebSocket lines while the backend restarted ("Error during WebSocket handshake: Unexpected response code: 502").

Each row is tested in each browser. Mark ✅ (works), ❌ (bug, with a link to the issue) or — (not applicable). Keep the browser console open during the whole run: no JavaScript errors or warnings may appear (only the expected network lines above).

| Area | What to check | Chrome | Firefox | Edge | Who |
|---|---|---|---|---|---|
| **Before login** | Login: wrong password shows "Invalid email or password"; empty fields show the app's own message | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Register: field messages next to the inputs; then login with the email filled in | | ✅ | ✅ | Diana (Firefox, Edge) |
| | "Log in with 42" reaches the 42 page | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Privacy Policy and Terms open in a new tab from Login and Register | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Language switcher EN / CS / ES before login | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Layout** | Sidebar, role switcher (also with ↓ ↑ Enter Escape), skip link (first Tab) | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Top bar: search opens the people search, bell and panel, user menu with Logout | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Footer links, every page opens at its top | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Student** | Home: banner plays and pauses, the four numbers, the three boxes | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Create a request (all steps), the success popup | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Evaluation page: accept and decline a proposed slot | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Pending: preview and cancel popups; History | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Hitchhikers: name search, Who, project, sort, Show more | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Profile: display name, language | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Hitchhiker** | Welcome popup, eligibility request, open queue | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Pick a slot (date and time choice), awaiting confirmation | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Head Tutor** | Eligibility table and request page: approve and decline | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Roles on a profile: assign and revoke | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Student Council** | Send a message; inbox, a message, mark read and unread, the shared note | | ✅ | ✅ | Diana (Firefox, Edge) |
| | History; Admin: reveal sender and delete | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Live updates** | Two browsers side by side: a Hitchhiker picks a slot, the student's page updates without reload | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Restart the backend: the app reconnects and loads again | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Accessibility** | Keyboard only through a whole workflow; popups keep the focus inside | | ✅ | ✅ | Diana (Firefox, Edge) |
| | Zoom 200 %: nothing cut off; reduced motion: still banner | | ✅ | ✅ | Diana (Firefox, Edge) |
| **Phone width** | Narrow window (about 400 px): sidebar as drawer, pages readable | | ✅ | ✅ | Diana (Firefox, Edge) |
