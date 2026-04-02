import './app.css';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './lib/monacoWorkers';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
