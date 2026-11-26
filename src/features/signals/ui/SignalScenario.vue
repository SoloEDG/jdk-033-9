<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Sailboat,
  ShieldQuestion,
  TimerOff,
} from 'lucide-vue-next'
import SignalTimeline from './SignalTimeline.vue'
import {
  COMMANDS,
  commandForTrack,
  describeAction,
  gateStateAt,
  type HelmSide,
  type SignalAction,
  type SignalScenario,
} from '../model/signals'

const props = defineProps<{ scenario: SignalScenario }>()
const scenario = computed(() => props.scenario)
const trackId = ref(props.scenario.initialTrackId)
const track = computed(() => scenario.value.tracks.find((item) => item.id === trackId.value) ?? scenario.value.tracks[0])

function buildLedger(): Record<string, SignalAction[]> {
  const ledger: Record<string, SignalAction[]> = {}
  for (const candidate of props.scenario.tracks) {
    ledger[candidate.id] = (props.scenario.scripted[candidate.id] ?? []).map((action) => ({ ...action }))
  }
  return ledger
}

const ledger = ref<Record<string, SignalAction[]>>(buildLedger())
const actionKey = computed(() => trackId.value)
const actions = computed<SignalAction[]>(() => ledger.value[actionKey.value] ?? [])
const timelineActions = computed<Record<string, SignalAction[]>>(() => ledger.value)

const now = ref(scenario.value.initialTime)
const playing = ref(false)
let frameId = 0
let lastTimestamp = 0
let userActionSequence = 0

const duration = computed(() => scenario.value.duration)
const deadline = computed(() => scenario.value.deadline)
const command = computed(() => commandForTrack(track.value))
const gate = computed(() => gateStateAt(scenario.value, track.value, actions.value, now.value))

const actionEntries = computed(() =>
  actions.value
    .map((action) => ({ action, state: describeAction(action, scenario.value, track.value, now.value) }))
    .sort((a, b) => a.action.at - b.action.at),
)

const certifiedNow = computed(
  () => track.value.certifiedAt !== null && now.value >= track.value.certifiedAt,
)
const timelyCertification = computed(
  () => track.value.certifiedAt !== null && track.value.certifiedAt <= deadline.value,
)
const remaining = computed(() => deadline.value - now.value)
const canIssueEvidenceOrder = computed(
  () =>
    command.value !== null &&
    track.value.certifiedAt !== null &&
    now.value >= track.value.certifiedAt &&
    now.value <= deadline.value,
)

const evidenceHeadline = computed(() => {
  if (track.value.certifiedAt === null) {
    return now.value > deadline.value
      ? '截止后仍无同组边界'
      : '只有颜色片段，分组未证实'
  }
  if (!certifiedNow.value) return '边界尚未出现'
  if (!timelyCertification.value) return '辨认完成，但已经迟到'
  return '升降边界已确认同组'
})

const missedNotice = computed(() => {
  if (track.value.certifiedAt === null && now.value > deadline.value) {
    return '这条航迹始终缺少可确认同组的升降边界；任何颜色拼接都不能改下一门线。'
  }
  if (track.value.certifiedAt !== null && track.value.certifiedAt > deadline.value && now.value >= deadline.value) {
    return `证据在 ${track.value.certifiedAt.toFixed(1)}s 才足够，晚于 ${deadline.value.toFixed(1)}s 截止；猜测操舵可保留航迹，但响应已错过，门线不改。`
  }
  return null
})

function pausePlayback() {
  playing.value = false
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
  lastTimestamp = 0
}

function animationFrame(timestamp: number) {
  if (!playing.value) return
  if (lastTimestamp) {
    const delta = Math.min(0.1, (timestamp - lastTimestamp) / 1000)
    now.value = Math.min(duration.value, Number((now.value + delta).toFixed(3)))
  }
  lastTimestamp = timestamp
  if (now.value >= duration.value) {
    pausePlayback()
    return
  }
  frameId = requestAnimationFrame(animationFrame)
}

function togglePlayback() {
  if (playing.value) {
    pausePlayback()
    return
  }
  if (now.value >= duration.value - 0.01) now.value = 0
  playing.value = true
  frameId = requestAnimationFrame(animationFrame)
}

function selectTrack(id: string) {
  trackId.value = id
}

function seek(time: number) {
  now.value = Math.max(0, Math.min(duration.value, time))
}

function resetToStart() {
  pausePlayback()
  now.value = 0
}

function resetScriptedExample() {
  pausePlayback()
  const current = scenario.value
  now.value = current.initialTime
  trackId.value = current.initialTrackId
  for (const candidate of current.tracks) {
    ledger.value[candidate.id] = (current.scripted[candidate.id] ?? []).map((action) => ({
      ...action,
    }))
  }
}

function steer(side: HelmSide) {
  const certified = track.value.certifiedAt !== null && now.value >= track.value.certifiedAt
  const mode = certified ? 'order' : 'guess'
  ledger.value[actionKey.value].push({
    id: `user-${++userActionSequence}`,
    at: Number(now.value.toFixed(2)),
    side,
    mode,
  })
}

function confirmCommand() {
  if (!canIssueEvidenceOrder.value || !command.value) return
  ledger.value[actionKey.value].push({
    id: `user-order-${++userActionSequence}`,
    at: Number(now.value.toFixed(2)),
    side: command.value.helm,
    mode: 'order',
  })
}

onUnmounted(pausePlayback)

const baselineGate = { a: { x: 205, y: 68 }, b: { x: 280, y: 166 } }
const provisionalGate = computed(() => {
  if (!gate.value.side) return baselineGate
  return gate.value.side === 'port' ? COMMANDS.RY.gate : COMMANDS.BG.gate
})
const activeGate = computed(() => gate.value.command?.gate ?? provisionalGate.value)

const boatPosition = computed(() => {
  const progress = Math.min(1, now.value / (duration.value * 0.86))
  return { x: 43 + progress * 151, y: 188 - progress * 78 }
})
const boatRotation = computed(() => {
  if (gate.value.side === 'port') return -13
  if (gate.value.side === 'starboard') return 13
  return 0
})

const stateText: Record<string, string> = {
  future: '未发生',
  effective: '有效改线',
  supported: '可追认',
  'validated-late': '迟到',
  waiting: '待证猜测',
  wrong: '方向不符',
  missed: '已错过',
  invalid: '证据不足',
}
</script>

<template>
  <section
    class="scenario-panel"
    :id="`signal-scenario-${scenario.id}`"
    :aria-label="scenario.title"
    :data-testid="`signal-scenario-panel-${scenario.id}`"
  >
    <header class="scenario-header">
      <span class="scenario-tab">{{ scenario.tab }}</span>
      <div>
        <h3>{{ scenario.title }}</h3>
        <p>同一组旗在连续展示期间先后露出的各旗可以合读；跨两组的片段不能合用。</p>
      </div>
    </header>

    <p class="premise">{{ scenario.premise }}</p>

    <div class="desk-grid">
      <div class="timeline-column">
        <div class="playback-bar">
          <button type="button" class="play-button" :aria-label="playing ? '暂停推演' : '播放推演'" @click="togglePlayback">
            <Pause v-if="playing" :size="16" />
            <Play v-else :size="16" />
            {{ playing ? '暂停' : now >= duration ? '重播' : '播放' }}
          </button>
          <button type="button" class="mini-button" title="回到 0s" @click="resetToStart"><RotateCcw :size="14" />回 0s</button>
          <button type="button" class="mini-button" title="恢复示例操舵" @click="resetScriptedExample">恢复示例</button>
          <label class="time-scrub">
            <span>{{ now.toFixed(1) }}s / {{ duration.toFixed(1) }}s</span>
            <input
              type="range"
              min="0"
              :max="duration"
              step="0.1"
              :value="now"
              aria-label="旗号观测时间"
              data-testid="signal-time-slider"
              @input="seek(Number(($event.target as HTMLInputElement).value))"
            >
          </label>
        </div>

        <SignalTimeline
          :scenario="scenario"
          :selected-track-id="trackId"
          :actions-by-track="timelineActions"
          :now="now"
          @seek="seek"
          @select-track="selectTrack"
        />

        <div class="interpretation-cards" data-testid="signal-interpretation-cards">
          <article
            v-for="item in track.interpretations"
            :key="item.id"
            :data-validity="item.validity"
            :data-testid="`signal-card-${item.id}`"
          >
            <header>
              <code>{{ item.code.join(' → ') }}</code>
              <h3>{{ item.name }}</h3>
              <span class="validity-pill">
                <CheckCircle2 v-if="item.validity === 'confirmed'" :size="13" />
                <AlertTriangle v-else-if="item.validity !== 'open'" :size="13" />
                <ShieldQuestion v-else :size="13" />
                {{
                  item.validity === 'confirmed'
                    ? '边界证实'
                    : item.validity === 'late-confirmed'
                      ? '证实但迟到'
                      : item.validity === 'rejected'
                        ? '边界排除'
                        : '证据未闭合'
                }}
              </span>
            </header>
            <p>{{ item.detail }}</p>
            <footer>
              <span><Clock3 :size="12" />观测 {{ item.from.toFixed(1) }}–{{ item.to.toFixed(1) }}s · 拼成于 {{ item.assembledAt.toFixed(1) }}s</span>
              <small>{{ item.sourceText }}</small>
            </footer>
          </article>
        </div>
      </div>

      <aside class="decision-column">
        <div class="track-switch" aria-label="选择航迹">
          <button
            v-for="candidate in scenario.tracks"
            :key="candidate.id"
            type="button"
            :aria-pressed="trackId === candidate.id"
            @click="selectTrack(candidate.id)"
          >
            <Eye :size="14" />{{ candidate.name }}
          </button>
        </div>

        <section class="decision-card" :data-gate-changed="gate.changed" data-testid="signal-decision-card">
          <h3><Sailboat :size="17" /> 门线响应判定</h3>
          <div class="evidence-line" :data-tone="certifiedNow ? (timelyCertification ? 'good' : 'late') : 'wait'" data-testid="signal-evidence">
            <component :is="certifiedNow && timelyCertification ? CheckCircle2 : certifiedNow ? TimerOff : ShieldQuestion" :size="18" />
            <div>
              <b>{{ evidenceHeadline }}</b>
              <small>
                {{ track.boundaryLabel }}
                <template v-if="track.certifiedAt !== null"> · 可辨时刻 {{ track.certifiedAt.toFixed(1) }}s</template>
              </small>
            </div>
          </div>

          <div class="time-grid">
            <div><span>响应截止</span><strong>{{ deadline.toFixed(1) }}s</strong></div>
            <div><span>相对截止</span><strong :data-overdue="remaining < 0">{{ remaining >= 0 ? `余 ${remaining.toFixed(1)}s` : `已过 ${Math.abs(remaining).toFixed(1)}s` }}</strong></div>
            <div><span>门线状态</span><strong :data-changed="gate.changed">{{ gate.changed ? '已改下一门线' : gate.provisional ? '仅猜测 / 未改线' : '原门下一线' }}</strong></div>
          </div>

          <div v-if="missedNotice" class="missed-banner" role="status" data-testid="signal-missed">
            <TimerOff :size="17" />
            <p>{{ missedNotice }}</p>
          </div>

          <svg class="gate-map" viewBox="0 0 360 220" role="img" aria-label="猜测舵迹与生效门线示意图" data-testid="signal-gate-map">
            <rect width="360" height="220" fill="#27555b" />
            <g stroke="#8fb4b5" stroke-opacity=".2">
              <path d="M0 44H360M0 88H360M0 132H360M0 176H360M48 0V220M96 0V220M144 0V220M192 0V220M240 0V220M288 0V220M336 0V220" />
            </g>
            <path d="M43 188 C92 178, 126 151, 164 126 S218 89, 270 74" fill="none" stroke="#e9f6ef" stroke-width="2" stroke-dasharray="5 7" opacity=".65" />

            <line
              data-gate-line="baseline"
              :x1="baselineGate.a.x" :y1="baselineGate.a.y" :x2="baselineGate.b.x" :y2="baselineGate.b.y"
              stroke="#a6b7a9" stroke-width="2" stroke-dasharray="7 6"
            />
            <circle :cx="baselineGate.a.x" :cy="baselineGate.a.y" r="7" fill="#e77c62" stroke="#173436" stroke-width="2" />
            <circle :cx="baselineGate.b.x" :cy="baselineGate.b.y" r="7" fill="#e77c62" stroke="#173436" stroke-width="2" />
            <text x="112" y="61" fill="#d8e1d3" font-size="12">原下一门线</text>

            <line
              v-if="gate.provisional && !gate.changed"
              :x1="provisionalGate.a.x" :y1="provisionalGate.a.y" :x2="provisionalGate.b.x" :y2="provisionalGate.b.y"
              stroke="#ffd455" stroke-width="3" stroke-dasharray="4 5" opacity=".9"
            />
            <line
              v-if="gate.provisional && !gate.changed"
              data-gate-line="provisional"
              :x1="provisionalGate.a.x" :y1="provisionalGate.a.y" :x2="provisionalGate.b.x" :y2="provisionalGate.b.y"
              stroke="#ffd455" stroke-width="3" stroke-dasharray="4 5" opacity=".9"
            />
            <line
              v-if="gate.changed"
              data-gate-line="effective"
              data-testid="signal-gate-line"
              :x1="activeGate.a.x" :y1="activeGate.a.y" :x2="activeGate.b.x" :y2="activeGate.b.y"
              stroke="#7cf0c8" stroke-width="4"
            />
            <circle v-if="gate.changed" :cx="activeGate.a.x" :cy="activeGate.a.y" r="8" fill="#7cf0c8" stroke="#173436" stroke-width="2" />
            <circle v-if="gate.changed" :cx="activeGate.b.x" :cy="activeGate.b.y" r="8" fill="#7cf0c8" stroke="#173436" stroke-width="2" />
            <text v-if="gate.changed" :x="activeGate.a.x - 8" :y="activeGate.a.y - 12" fill="#7cf0c8" font-size="13" font-weight="700">
              证据生效：{{ command?.gateName }}
            </text>
            <text v-else-if="gate.provisional" x="34" y="34" fill="#ffd455" font-size="12">猜测舵向已显示，但门线未改</text>

            <g :transform="`translate(${boatPosition.x} ${boatPosition.y}) rotate(${boatRotation})`">
              <path d="M0 -15 L8 12 L0 7 L-8 12 Z" fill="#fff4db" stroke="#173436" stroke-width="1.5" />
              <path d="M0 -10V8" stroke="#31585a" stroke-width="2" />
            </g>
          </svg>

          <button
            type="button"
            class="confirm-order"
            data-testid="signal-confirm-order"
            :disabled="!canIssueEvidenceOrder"
            @click="confirmCommand"
          >
            <CheckCircle2 :size="16" />
            {{ canIssueEvidenceOrder ? `按已证命令响应：${command?.label}` : '证据未闭合或已过截止，不能下生效舵令' }}
          </button>

          <div class="steer-buttons">
            <button type="button" data-testid="signal-steer-port" @click="steer('port')">
              <span class="helm-arrow">↰</span> 先操左舵
              <small>{{ certifiedNow ? '记录为证据舵令' : '记录为猜测' }}</small>
            </button>
            <button type="button" data-testid="signal-steer-starboard" @click="steer('starboard')">
              <span class="helm-arrow mirror">↰</span> 先操右舵
              <small>{{ certifiedNow ? '记录为证据舵令' : '记录为猜测' }}</small>
            </button>
          </div>
          <p class="rule-note">规则：猜测可以立即改变船首/航迹；只有在当前时刻已能辨认、舵令不晚于截止且方向符合确认命令时，下一门线才改变。</p>
        </section>

        <section class="action-log" aria-label="操舵响应判定记录">
          <h3>响应记录</h3>
          <ol>
            <li v-for="entry in actionEntries" :key="entry.action.id" :data-verdict="entry.state.verdict">
              <time>{{ entry.action.at.toFixed(1) }}s</time>
              <b>{{ entry.action.side === 'port' ? '左舵' : '右舵' }} · {{ entry.action.mode === 'order' ? '舵令' : '猜测' }}</b>
              <span class="verdict">{{ stateText[entry.state.verdict] }}</span>
              <p>{{ entry.state.headline }}。{{ entry.state.detail }}</p>
            </li>
            <li v-if="!actionEntries.length" class="no-action">尚未操舵；可拖动时间后点击左/右舵。</li>
          </ol>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.scenario-panel {
  margin-top: 16px;
  padding-top: 15px;
  border-top: 2px solid #c6c0aa;
}
.scenario-panel:first-of-type {
  margin-top: 4px;
}
.scenario-header {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}
.scenario-tab {
  flex: none;
  padding: 7px 10px;
  background: #31585a;
  color: #fff4db;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.scenario-header h3 {
  margin: 0;
  font-size: 18px;
  line-height: 1.15;
}
.scenario-header p {
  margin: 5px 0 0;
  color: #65624f;
  font-size: 12px;
  line-height: 1.45;
}
.premise {
  margin: 12px 0;
  padding: 9px 11px;
  border-left: 4px solid #c99024;
  background: #fff1c7;
  color: #4e4327;
  font-size: 13px;
  line-height: 1.55;
}
.desk-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 14px;
  align-items: start;
}
.timeline-column,
.decision-column {
  min-width: 0;
}
.playback-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  flex-wrap: wrap;
}
.play-button,
.mini-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  border-radius: 3px;
  border: 1px solid #31585a;
  padding: 0 11px;
  background: #31585a;
  color: #fff4db;
  font-size: 12px;
  font-weight: 700;
}
.mini-button {
  background: #fffae8;
  color: #31585a;
}
.time-scrub {
  flex: 1;
  min-width: 220px;
  display: grid;
  grid-template-columns: 86px minmax(120px, 1fr);
  align-items: center;
  gap: 8px;
  font: 11px var(--mono);
}
.time-scrub input {
  width: 100%;
  accent-color: #31585a;
}
.interpretation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
  gap: 9px;
  margin-top: 11px;
}
.interpretation-cards article {
  padding: 10px;
  border: 1px solid #c9c1a8;
  border-top-width: 4px;
  background: #fff9e8;
}
.interpretation-cards article[data-validity='confirmed'] { border-top-color: #2f7d55; }
.interpretation-cards article[data-validity='late-confirmed'] { border-top-color: #d18a16; }
.interpretation-cards article[data-validity='rejected'] { border-top-color: #a33d27; }
.interpretation-cards article[data-validity='open'] { border-top-color: #777461; }
.interpretation-cards header {
  display: flex;
  align-items: center;
  gap: 7px;
}
.interpretation-cards code {
  padding: 2px 5px;
  background: #e7dfc6;
  font: 800 12px var(--mono);
}
.interpretation-cards h3 {
  margin: 0;
  font-size: 13px;
  line-height: 1.25;
}
.validity-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  font-size: 10px;
  color: #5f6254;
}
.interpretation-cards p {
  margin: 8px 0;
  font-size: 12px;
  line-height: 1.55;
}
.interpretation-cards footer {
  display: grid;
  gap: 4px;
  color: #686653;
  font-size: 11px;
}
.interpretation-cards footer span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--mono);
}
.interpretation-cards small {
  line-height: 1.4;
}
.decision-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.track-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.track-switch button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  border: 1px solid #b5b09c;
  background: #fffae8;
  font-size: 12px;
  font-weight: 700;
}
.track-switch button[aria-pressed='true'] {
  border-color: #31585a;
  background: #31585a;
  color: #fff4db;
}
.scenario-panel section.decision-card,
.action-log {
  border: 1px solid var(--rule);
  background: #fff9e8;
  padding: 12px;
}
.decision-card h3,
.action-log h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 10px;
  font-size: 15px;
}
.evidence-line {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  padding: 9px;
  border: 1px solid;
}
.evidence-line[data-tone='good'] {
  color: #245d3d;
  border-color: #8fbea2;
  background: #e1f2e7;
}
.evidence-line[data-tone='wait'] {
  color: #66561e;
  border-color: #d6bd69;
  background: #fff0bd;
}
.evidence-line[data-tone='late'] {
  color: #84331f;
  border-color: #d4937f;
  background: #f8ddd3;
}
.evidence-line b {
  display: block;
  font-size: 13px;
}
.evidence-line small {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
}
.time-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 10px 0;
}
.time-grid div {
  padding: 7px;
  background: #efe8d1;
}
.time-grid span {
  display: block;
  font-size: 10px;
  color: #74705d;
}
.time-grid strong {
  display: block;
  margin-top: 3px;
  font: 700 12px var(--mono);
}
.time-grid strong[data-overdue='true'] {
  color: #a33d27;
}
.time-grid strong[data-changed='true'] {
  color: #1f6b46;
}
.missed-banner {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0 0 10px;
  padding: 9px;
  color: #fff0e8;
  background: #8f321f;
  border: 1px solid #672415;
}
.missed-banner svg {
  flex: none;
  margin-top: 1px;
}
.missed-banner p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
.gate-map {
  width: 100%;
  height: auto;
  display: block;
  border: 1px solid #173436;
}
.confirm-order {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  margin-top: 10px;
  padding: 6px 10px;
  border: 1px solid #17492f;
  border-radius: 3px;
  background: #2f7d55;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}
.confirm-order:not(:disabled):hover {
  background: #379063;
}
.steer-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 9px;
}
.steer-buttons button {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 6px;
  padding: 8px;
  border: 1px solid #31585a;
  background: #f3e7bd;
  color: #203d3f;
  font-weight: 800;
  font-size: 13px;
  text-align: left;
}
.steer-buttons button:hover {
  background: #ffd455;
}
.steer-buttons small {
  grid-column: 2;
  font-weight: 500;
  font-size: 10px;
  color: #65624f;
}
.helm-arrow {
  grid-row: span 2;
  font-size: 24px;
  line-height: 1;
}
.helm-arrow.mirror {
  transform: scaleX(-1);
}
.rule-note {
  margin: 9px 0 0;
  color: #65624f;
  font-size: 11px;
  line-height: 1.5;
}
.action-log ol {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow: auto;
}
.action-log li {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 5px;
  align-items: baseline;
  padding: 8px 2px;
  border-top: 1px solid #ddd5bd;
}
.action-log time {
  font: 11px var(--mono);
  color: #6d6a58;
}
.action-log b {
  font-size: 12px;
}
.verdict {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 10px;
  background: #ddd5bd;
}
.action-log p {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: #5f6254;
}
.action-log li[data-verdict='effective'] .verdict { background: #cde7d5; color: #245d3d; }
.action-log li[data-verdict='waiting'] .verdict,
.action-log li[data-verdict='supported'] .verdict { background: #ffe39a; color: #76500b; }
.action-log li[data-verdict='missed'] .verdict,
.action-log li[data-verdict='validated-late'] .verdict { background: #f0c6bb; color: #8f321f; }
.action-log li[data-verdict='wrong'] .verdict,
.action-log li[data-verdict='invalid'] .verdict { background: #d6d2c2; color: #4d4b3e; }
.no-action {
  font-size: 12px;
  color: #74705d;
}
@media (max-width: 1100px) {
  .desk-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .scenario-header {
    flex-direction: column;
    gap: 6px;
  }
  .track-switch {
    grid-template-columns: 1fr;
  }
  .time-grid {
    grid-template-columns: 1fr;
  }
  .steer-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
