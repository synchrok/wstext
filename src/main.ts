// Tag <html> with `is-mac` / `is-windows` BEFORE first paint so the
// platform-scoped rules in app.css apply correctly on the very first frame.
import './lib/platform';
import './app.css';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './lib/monacoWorkers';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
