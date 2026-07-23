import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import enOracle from '../../i18n/locales/en/oracle';
import viOracle from '../../i18n/locales/vi/oracle';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(__dirname, '../../../');

test('1. Existing /oracle route is reused and not duplicated', () => {
  const routerPath = path.resolve(feRoot, 'src/router/index.ts');
  const content = fs.readFileSync(routerPath, 'utf8');
  const matches = content.match(/path:\s*['"]oracle['"]/g);
  assert.equal(matches?.length, 1, 'there should be exactly one /oracle route registration');
});

test('2. Existing Oracle navigation entry is reused and not duplicated', () => {
  const sidebarPath = path.resolve(feRoot, 'src/layouts/AppSidebar.vue');
  const content = fs.readFileSync(sidebarPath, 'utf8');
  const matches = content.match(/to:\s*['"]\/oracle['"]/g);
  assert.equal(matches?.length, 1, 'there should be exactly one Oracle sidebar item targeting /oracle');
});

test('3. Thread state comes from the Oracle store without fake production data', () => {
  const oracleViewPath = path.resolve(feRoot, 'src/features/oracle/OracleView.vue');
  const storePath = path.resolve(feRoot, 'src/store/useOracleChatStore.ts');
  const viewContent = fs.readFileSync(oracleViewPath, 'utf8');
  const storeContent = fs.readFileSync(storePath, 'utf8');
  assert.ok(storeContent.includes('const threads = ref<OracleThreadItem[]>([])'), 'store threads must default to empty');
  assert.ok(storeContent.includes('await listOracleThreads()'), 'thread list must come from the authenticated API');
  assert.ok(viewContent.includes('ref<OracleShellMessage[]>([])'), 'messages must remain empty until loaded from backend');
  assert.ok(!viewContent.includes('const threads = ref(['), 'view must not embed fake thread fixtures');
  assert.ok(!viewContent.includes('const activeMessages = ref([{'), 'view must not embed fake answer fixtures');
});

test('4. Composer exposes one automatic conversation flow instead of manual mode pills', () => {
  const composerPath = path.resolve(feRoot, 'src/features/oracle/components/OracleComposer.vue');
  const content = fs.readFileSync(composerPath, 'utf8');
  assert.ok(content.includes("t('oracle.automaticMode')"), 'automatic response hint is present');
  assert.ok(!content.includes('role="radiogroup"'), 'manual mode picker is removed');
  assert.ok(!content.includes('oracle-composer__mode-pill'), 'mode pills are removed');
});

test('5. Internal modes remain typed for server-side intent routing', () => {
  const typesPath = path.resolve(feRoot, 'src/features/oracle/oracleShell.types.ts');
  const content = fs.readFileSync(typesPath, 'utf8');
  assert.ok(content.includes("'chat' | 'dream_analysis' | 'creative_continuation'"), 'OracleMode union type correctly declared');
});

test('6. Send is enabled only with content and emits through the real Oracle flow', () => {
  const composerPath = path.resolve(feRoot, 'src/features/oracle/components/OracleComposer.vue');
  const content = fs.readFileSync(composerPath, 'utf8');
  assert.ok(content.includes(':disabled="!inputContent.trim() && !isSending"'), 'empty idle composer must be disabled');
  assert.ok(content.includes("emit('send', content)"), 'non-empty content must emit a real send event');
  assert.ok(content.includes('@keydown.enter.exact.prevent="submit"'), 'Enter must submit through the same path');
  assert.ok(content.includes("$emit('cancel')"), 'running composer must expose stop generation');

  const chatShellPath = path.resolve(feRoot, 'src/features/oracle/components/OracleChatShell.vue');
  const chatShellContent = fs.readFileSync(chatShellPath, 'utf8');
  assert.ok(chatShellContent.includes('oracle-source-card'), 'assistant sources render as interactive cards');
  assert.ok(chatShellContent.includes('oracle-suggestions'), 'follow-up suggestions render above the composer');
  assert.ok(chatShellContent.includes('::selection'), 'user message selection has an explicit readable contrast');
});

test('7. No production file imports a fake stream or fake provider', () => {
  const oracleDir = path.resolve(feRoot, 'src/features/oracle');
  const files = (fs.readdirSync(oracleDir, { recursive: true }) as string[]).filter(
    (f) => !f.endsWith('.test.ts') && (f.endsWith('.ts') || f.endsWith('.vue'))
  );
  for (const f of files) {
    const fullPath = path.resolve(oracleDir, f);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(!content.includes('FakeStream'), `${f} must not import FakeStream`);
    assert.ok(!content.includes('FakeProvider'), `${f} must not import FakeProvider`);
  }
});

test('8. Mobile sidebar open/close structure and backdrop props exist', () => {
  const sidebarPath = path.resolve(feRoot, 'src/features/oracle/components/OracleThreadSidebar.vue');
  const content = fs.readFileSync(sidebarPath, 'utf8');
  assert.ok(content.includes('oracle-sidebar-backdrop'), 'backdrop element exists');
  assert.ok(content.includes('closeSidebar'), 'close function exists');
});

test('9. Escape key handler closes mobile sidebar', () => {
  const sidebarPath = path.resolve(feRoot, 'src/features/oracle/components/OracleThreadSidebar.vue');
  const content = fs.readFileSync(sidebarPath, 'utf8');
  assert.ok(content.includes("e.key === 'Escape'"), 'Escape key handler exists');
});

test('10. English and Vietnamese Oracle catalogs have exact key parity', () => {
  const enKeys = Object.keys(enOracle).sort();
  const viKeys = Object.keys(viOracle).sort();
  assert.deepEqual(enKeys, viKeys, 'Oracle en and vi catalogs must have identical keys');
  assert.ok(enKeys.length >= 15, 'must contain required translation keys');
});

test('11. No new Oracle component contains hard-coded user-visible bilingual text', () => {
  const compDir = path.resolve(feRoot, 'src/features/oracle/components');
  const compFiles = fs.readdirSync(compDir).filter((f) => f.endsWith('.vue'));
  for (const file of compFiles) {
    const content = fs.readFileSync(path.resolve(compDir, file), 'utf8');
    // Basic check for un-translated Vietnamese words like "Cuộc trò chuyện" inside template text
    assert.ok(!/>\s*Cuộc trò chuyện\s*</i.test(content), `${file} should use i18n for Cuộc trò chuyện`);
    assert.ok(!/>\s*Trò chuyện\s*</i.test(content), `${file} should use i18n for Trò chuyện`);
  }
});

test('12. Existing human messaging components are unchanged', () => {
  const messagesDir = path.resolve(feRoot, 'src/features/messages');
  const files = ['MessagesView.vue', 'ConversationList.vue', 'ChatWindow.vue'];
  for (const f of files) {
    assert.ok(fs.existsSync(path.resolve(messagesDir, f)), `${f} must exist in human messaging feature`);
  }
});

test('13. Background runs survive navigation and ETA uses one remaining-time value', () => {
  const viewContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/oracle/OracleView.vue'),
    'utf8',
  );
  const storeContent = fs.readFileSync(
    path.resolve(feRoot, 'src/store/useOracleChatStore.ts'),
    'utf8',
  );
  const chatShellContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/oracle/components/OracleChatShell.vue'),
    'utf8',
  );
  const toastContent = fs.readFileSync(
    path.resolve(feRoot, 'src/components/common/MessageToastContainer.vue'),
    'utf8',
  );

  assert.ok(
    viewContent.includes("createdForThisMessage && !runPersisted && error?.name !== 'AbortError'"),
    'leaving the page after a run is persisted must not delete its new thread',
  );
  assert.ok(
    storeContent.includes('await getOracleRunStatus(tracked.runId)'),
    'background completion must be determined from the exact run resource',
  );
  assert.ok(
    !storeContent.includes('if (!current?.activeRunId) completeRun'),
    'thread-list absence must never be treated as run completion',
  );
  assert.ok(
    !chatShellContent.includes("t('oracle.thinkingWithEta'"),
    'chat ETA must not render a two-value remaining-time range',
  );
  assert.ok(
    !toastContent.includes("t('oracle.backgroundEtaRange'"),
    'pinned ETA must not render a two-value remaining-time range',
  );
});

test('14. Long-running task pins share one collapsible component', () => {
  const containerContent = fs.readFileSync(
    path.resolve(feRoot, 'src/components/common/MessageToastContainer.vue'),
    'utf8',
  );
  const pinContent = fs.readFileSync(
    path.resolve(feRoot, 'src/components/common/PinnedTaskToast.vue'),
    'utf8',
  );

  assert.equal(
    containerContent.match(/<PinnedTaskToast\b/gu)?.length,
    5,
    'Oracle, dream analysis, Rule V3, source import, and queued jobs must use the same pin component',
  );
  assert.ok(!containerContent.includes('pinned-toast__close'), 'task pins must not retain an X dismiss control');
  assert.ok(pinContent.includes('pinned-task-toast--collapsed'), 'shared pin must support edge collapse');
  assert.ok(pinContent.includes('if (terminal && !previous) collapsed.value = false'), 'completed hidden work must slide back out');
  for (const kind of ['oracle-chat', 'dream-analysis', 'rule-analysis', 'source-import', 'queue']) {
    assert.ok(pinContent.includes(`pinned-task-toast--${kind}`), `${kind} must have a distinct accent`);
  }
});

test('15. Unsupported Oracle claims have a moderator research workflow', () => {
  const viewContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/moderation/ModerationSourcesView.vue'),
    'utf8',
  );
  const apiContent = fs.readFileSync(
    path.resolve(feRoot, 'src/api/moderationApi.ts'),
    'utf8',
  );

  assert.ok(viewContent.includes("'evidence_gaps'"), 'source moderation must expose an evidence-gap tab');
  assert.ok(viewContent.includes("t('oracle.evidenceCopyAll')"), 'moderators need a compact one-click research export');
  assert.ok(!viewContent.includes('Cần tìm loại bằng chứng nào?'), 'repeated research criteria must stay inside the copied prompt');
  assert.ok(!viewContent.includes("'candidate_found', label"), 'candidate matching must not create a third user-facing status');
  assert.ok(apiContent.includes("'/moderation/oracle-evidence-gaps'"), 'evidence gaps must load from the protected moderation API');
});

test('16. Editing reuses the composer and replaces the visible branch', () => {
  const shellContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/oracle/components/OracleChatShell.vue'),
    'utf8',
  );
  const composerContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/oracle/components/OracleComposer.vue'),
    'utf8',
  );
  const viewContent = fs.readFileSync(
    path.resolve(feRoot, 'src/features/oracle/OracleView.vue'),
    'utf8',
  );

  assert.ok(!shellContent.includes('oracle-msg__editor'), 'timeline must not render a second editing textarea');
  assert.ok(shellContent.includes('oracle-edit-context'), 'editing context must sit above the main composer');
  assert.ok(shellContent.includes('composer.value?.setContent(message.content)'), 'edit must preload the main composer');
  assert.ok(composerContent.includes('defineExpose({ focus, setContent, clear })'), 'composer must expose safe edit controls');
  assert.ok(viewContent.includes('activeMessages.value.splice(editedMessageIndex)'), 'the old branch must be replaced before rendering its edit');
  assert.match(
    shellContent,
    /\.oracle-msg__user-tools\s*\{[\s\S]*?opacity:\s*1;/u,
    'copy, edit, and branch navigation must remain visible without hover',
  );
});
