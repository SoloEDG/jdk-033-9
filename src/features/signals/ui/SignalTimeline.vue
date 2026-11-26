<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff, TimerOff } from 'lucide-vue-next'
import {
  describeAction,
  timePercent,
  type SignalAction,
  type SignalScenario,
  type SignalTrack,
} from '../model/signals'

const props = defineProps<{
  scenario: SignalScenario
  selectedTrackId: string
  actionsByTrack: Record<string, SignalAction[]>
  now: number
}>()

const emit = defineEmits<{
  seek: [time: number]
  selectTrack: [trackId: string]
}>()

const p = (time: number) => timePercent(time, props.scenario.duration)
const width = (from: number, to: number) => timePercent(to - from, props.scenario.duration)

const ticks = computed(() => {
  const out: number[] = []
  for (let t = 0; t <= props.scenario.duration + 0.001; t += 2) out.push(Number(t.toFixed(1)))
  return out
})

const globalLineStyle = (time: number) => ({
  left: `calc(var(--label-w) + (100% - var(--label-w)) * ${time / props.scenario.duration})`,
})

const deadlineStyle = computed(() => globalLineStyle(props.scenario.deadline))
const playheadStyle = computed(() => globalLineStyle(props.now))
const deadlineShadeStyle = computed(() => ({
  left: `calc(var(--label-w) + (100% - var(--label-w)) * ${props.scenario.deadline / props.scenario.duration})`,
}))

function seekRuler(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  emit('seek', Number((ratio * props.scenario.duration).toFixed(2)))
}

function actionStates(track: SignalTrack) {
  return (props.actionsByTrack[track.id] ?? []).map((action) => ({
    action,
    state: describeAction(action, props.scenario, track, props.now),
  }))
}

function innerPercent(time: number, from: number, to: number) {
  if (to <= from) return 0
  return Math.min(100, Math.max(0, ((time - from) / (to - from)) * 100))
}
</script>

<template>
  <div class="signal-timeline" data-testid="signal-timeline">
    <div class="tl-inner" style="--label-w: 132px">
      <div class="deadline-shade" :style="deadlineShadeStyle" aria-hidden="true" />
      <div class="global-deadline" :style="deadlineStyle" aria-hidden="true">
        <span><TimerOff :size="12" /> 响应截止 {{ scenario.deadline.toFixed(1) }}s</span>
      </div>
      <div class="global-playhead" :style="playheadStyle" aria-hidden="true"><i /></div>

      <div class="tl-grid">
        <div class="tl-corner">观测时段 ↓ / 时间 →</div>
        <div class="tl-lane ruler-lane" @click="seekRuler">
          <span v-for="tick in ticks" :key="tick" class="tick" :style="{ left: `${p(tick)}%` }">
            <i />{{ tick }}s
          </span>
        </div>

        <div class="tl-label strong">岸台实际发送</div>
        <div class="tl-lane actual-lane">
          <div
            v-for="group in scenario.groups"
            :key="group.id"
            class="group-bracket"
            :data-group="group.id"
            :style="{ left: `${p(group.hoist)}%`, width: `${width(group.hoist, group.gone)}%` }"
          >
            {{ group.id }} 组 · {{ group.code.join('–') }}
          </div>
          <span
            v-for="flag in scenario.flags"
            :key="flag.id"
            class="flag-block"
            :data-color="flag.color"
            :data-group="flag.groupId"
            :style="{ left: `${p(flag.clearAt)}%`, width: `${width(flag.clearAt, flag.goneAt)}%` }"
            :title="`${flag.groupId}组 ${flag.color}旗：清晰 ${flag.clearAt}s，降完 ${flag.goneAt}s`"
          >
            <b>{{ flag.color }}</b><span>{{ flag.clearAt.toFixed(1) }}–{{ flag.goneAt.toFixed(1) }}s</span>
          </span>
        </div>

        <template v-for="track in scenario.tracks" :key="track.id">
          <button
            type="button"
            class="tl-label track-label"
            :data-active="selectedTrackId === track.id"
            :data-boundary="track.boundary"
            :data-testid="`signal-track-${track.id}`"
            @click="emit('selectTrack', track.id)"
          >
            <component :is="track.boundary === 'hidden' ? EyeOff : Eye" :size="15" />
            <span><b>{{ track.name }}</b><small>{{ track.boundaryLabel }}</small></span>
          </button>
          <div class="tl-lane observation-lane" :data-boundary="track.boundary">
            <span
              v-for="obs in track.observations"
              :key="obs.id"
              class="observed-flag"
              :data-color="obs.color"
              :style="{ left: `${p(obs.from)}%`, width: `${width(obs.from, obs.to)}%` }"
              :title="`${track.name}：${obs.color}色片段 ${obs.from.toFixed(1)}–${obs.to.toFixed(1)}s`"
            >
              {{ obs.color }}
            </span>
            <template v-for="obs in track.observations" :key="`${obs.id}-boundaries`">
              <i
                v-if="obs.hoistBoundaryAt !== undefined"
                class="boundary-marker hoist"
                :style="{ left: `${p(obs.hoistBoundaryAt)}%` }"
                :title="`${obs.color}旗升边界`"
              />
              <i
                v-if="obs.lowerBoundaryAt !== undefined"
                class="boundary-marker lower"
                :style="{ left: `${p(obs.lowerBoundaryAt)}%` }"
                :title="`${obs.color}旗降边界`"
              />
            </template>
            <i
              v-if="track.boundary === 'late' && track.certifiedAt !== null"
              class="boundary-marker late-cert"
              :style="{ left: `${p(track.certifiedAt)}%` }"
              :title="`${track.certifiedAt.toFixed(1)}s 才确认同组`"
            />
            <span v-if="track.boundary === 'hidden'" class="occlusion-note">桁端 / 索扣不可见</span>
          </div>

          <template v-for="item in track.interpretations" :key="item.id">
            <div class="tl-label interpretation-label" :data-validity="item.validity">
              <code>{{ item.code.join('') }}</code>
              <span>{{ item.validity === 'open' ? '待证解释' : item.validity === 'rejected' ? '排除' : item.validity === 'late-confirmed' ? '迟到确认' : '已确认' }}</span>
            </div>
            <div class="tl-lane interpretation-lane">
              <div
                class="interp-bar"
                :data-validity="item.validity"
                :data-testid="`signal-interpretation-${item.id}`"
                :style="{ left: `${p(item.from)}%`, width: `${width(item.from, item.to)}%` }"
                :title="item.detail"
              >
                <span class="bar-code">{{ item.code.join('–') }}</span>
                <span class="bar-name">{{ item.name }}</span>
                <i
                  v-if="item.overlap"
                  class="overlap-segment"
                  :style="{
                    left: `${innerPercent(item.overlap.from, item.from, item.to)}%`,
                    width: `${innerPercent(item.overlap.to, item.from, item.to) - innerPercent(item.overlap.from, item.from, item.to)}%`,
                  }"
                  title="两组交接时同时可见"
                />
                <i
                  v-if="item.certifiedAt !== null"
                  class="cert-tick"
                  :data-late="item.validity === 'late-confirmed'"
                  :style="{ left: `${innerPercent(item.certifiedAt, item.from, item.to)}%` }"
                  :title="`辨认完成 ${item.certifiedAt.toFixed(1)}s`"
                />
              </div>
            </div>
          </template>

          <div class="tl-label action-label">操舵 / 响应</div>
          <div class="tl-lane action-lane">
            <span
              v-for="entry in actionStates(track)"
              :key="entry.action.id"
              class="action-marker"
              :data-verdict="entry.state.verdict"
              :data-mode="entry.action.mode"
              :data-scripted="entry.action.scripted === true"
              :data-testid="`signal-action-${entry.action.id}`"
              :style="{ left: `${p(entry.action.at)}%` }"
              :title="`${entry.action.at.toFixed(1)}s ${entry.action.side === 'port' ? '左舵' : '右舵'}：${entry.state.headline}。${entry.state.detail}`"
            >
              {{ entry.action.side === 'port' ? '左' : '右' }}
            </span>
            <span v-if="!actionStates(track).length" class="empty-actions">暂无操舵记录</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.signal-timeline {
  border: 1px solid #c6c0aa;
  background: #f8f2df;
  overflow-x: auto;
  overflow-y: hidden;
}
.tl-inner {
  position: relative;
  min-width: 760px;
  padding-bottom: 8px;
}
.deadline-shade {
  position: absolute;
  top: 0;
  bottom: 0;
  background: repeating-linear-gradient(135deg, rgba(137, 59, 39, 0.07) 0 8px, rgba(137, 59, 39, 0.02) 8px 16px);
  pointer-events: none;
  z-index: 0;
}
.global-deadline {
  position: absolute;
  top: 25px;
  bottom: 4px;
  width: 2px;
  background: #a33d27;
  z-index: 5;
  pointer-events: none;
}
.global-deadline span {
  position: absolute;
  top: 2px;
  left: 5px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  color: #8f321f;
  background: #f8e4d6;
  border: 1px solid #c98268;
  font: 10px/1.2 var(--mono);
  padding: 2px 4px;
}
.global-playhead {
  position: absolute;
  top: 20px;
  bottom: 2px;
  width: 1px;
  background: #20272c;
  z-index: 8;
  pointer-events: none;
}
.global-playhead i {
  position: absolute;
  top: 0;
  left: -5px;
  width: 11px;
  height: 11px;
  background: #20272c;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.tl-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: var(--label-w) minmax(0, 1fr);
}
.tl-corner,
.tl-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 4px 8px;
  border-bottom: 1px solid #ddd5bd;
  background: #efe8d1;
  color: #4c544c;
  font-size: 11px;
}
.tl-corner {
  font: 10px var(--mono);
  color: #777461;
}
.tl-label.strong {
  font-weight: 800;
  color: #20272c;
}
.tl-lane {
  position: relative;
  min-width: 0;
  border-bottom: 1px solid #ddd5bd;
}
.ruler-lane {
  height: 28px;
  cursor: crosshair;
  background: #f3ecd6;
}
.tick {
  position: absolute;
  top: 5px;
  transform: translateX(-50%);
  font: 10px var(--mono);
  color: #777461;
  white-space: nowrap;
}
.tick i {
  display: block;
  width: 1px;
  height: 5px;
  margin: 0 auto 1px;
  background: #aaa38c;
}
.actual-lane {
  height: 61px;
}
.group-bracket {
  position: absolute;
  top: 5px;
  height: 17px;
  display: flex;
  align-items: center;
  padding: 0 5px;
  border: 1px solid #31585a;
  border-bottom: 0;
  border-radius: 3px 3px 0 0;
  color: #31585a;
  background: rgba(49, 88, 90, 0.08);
  font: 700 10px/1 var(--mono);
  white-space: nowrap;
  overflow: hidden;
}
.group-bracket[data-group='B'] {
  border-color: #6b5b95;
  color: #5a4b82;
  background: rgba(107, 91, 149, 0.08);
}
.flag-block {
  position: absolute;
  top: 27px;
  height: 25px;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 28px;
  padding: 0 5px;
  border: 1px solid rgba(32, 39, 44, 0.35);
  border-radius: 2px;
  color: white;
  font: 10px var(--mono);
  white-space: nowrap;
  overflow: hidden;
}
.flag-block b {
  font: 800 13px var(--display);
}
.flag-block[data-color='R'],
.observed-flag[data-color='R'] { background: #c84b3f; }
.flag-block[data-color='Y'],
.observed-flag[data-color='Y'] { background: #e4b936; color: #2c2817; }
.flag-block[data-color='B'],
.observed-flag[data-color='B'] { background: #315fae; }
.flag-block[data-color='G'],
.observed-flag[data-color='G'] { background: #3c8a58; }
.track-label {
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  border-left: 0;
  border-top: 0;
  border-right: 1px solid #ddd5bd;
  cursor: pointer;
}
.track-label span {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.track-label small {
  font-size: 10px;
  color: #73705e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-label[data-active='true'] {
  background: #31585a;
  color: #fff4db;
}
.track-label[data-active='true'] small {
  color: #c9d8cf;
}
.observation-lane {
  height: 42px;
  background:
    linear-gradient(transparent 20px, rgba(49, 88, 90, 0.08) 20px, rgba(49, 88, 90, 0.08) 21px, transparent 21px);
}
.observed-flag {
  position: absolute;
  top: 10px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 2px;
  color: #fff;
  font: 800 12px var(--display);
  box-shadow: inset 0 -3px rgba(0, 0, 0, 0.12);
}
.boundary-marker {
  position: absolute;
  top: 4px;
  width: 2px;
  height: 34px;
  background: #20272c;
  z-index: 3;
}
.boundary-marker.hoist {
  background: #2f7d55;
  clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
}
.boundary-marker.lower {
  background: #a33d27;
  clip-path: polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%);
}
.boundary-marker.late-cert {
  width: 3px;
  background: #b66a00;
  box-shadow: 0 0 0 3px rgba(182, 106, 0, 0.18);
}
.occlusion-note {
  position: absolute;
  right: 6px;
  top: 2px;
  color: #8a8067;
  font: 10px var(--mono);
}
.interpretation-label {
  gap: 5px;
  justify-content: space-between;
}
.interpretation-label code {
  font: 700 12px var(--mono);
  padding: 1px 4px;
  background: #e2dac1;
}
.interpretation-label span {
  font-size: 10px;
  color: #6d6a58;
}
.interpretation-label[data-validity='confirmed'] code { background: #cde7d5; color: #245d3d; }
.interpretation-label[data-validity='rejected'] code { background: #f0d0c7; color: #8f321f; }
.interpretation-label[data-validity='late-confirmed'] code { background: #f5d79b; color: #76500b; }
.interpretation-lane {
  height: 38px;
}
.interp-bar {
  position: absolute;
  top: 7px;
  height: 24px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 44px;
  padding: 0 7px;
  border: 1px solid;
  border-radius: 3px;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
}
.bar-code {
  font: 800 12px var(--mono);
}
.bar-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.interp-bar[data-validity='confirmed'] {
  border-color: #2f7d55;
  background: #dff1e5;
  color: #214f37;
}
.interp-bar[data-validity='late-confirmed'] {
  border-color: #b66a00;
  background: #ffe7ad;
  color: #65430a;
}
.interp-bar[data-validity='rejected'] {
  border-color: #b96552;
  background: #f5d9d0;
  color: #7d2d1c;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.interp-bar[data-validity='open'] {
  border-style: dashed;
  border-color: #777461;
  background: repeating-linear-gradient(45deg, #f5efd9 0 7px, #e9e1c8 7px 14px);
  color: #555344;
}
.overlap-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(163, 61, 39, 0.28);
  border-left: 1px solid rgba(163, 61, 39, 0.75);
  border-right: 1px solid rgba(163, 61, 39, 0.75);
  pointer-events: none;
}
.cert-tick {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: #1f6b46;
  box-shadow: 0 0 0 2px rgba(31, 107, 70, 0.15);
}
.cert-tick[data-late='true'] {
  background: #9a5b00;
  box-shadow: 0 0 0 2px rgba(154, 91, 0, 0.16);
}
.action-label {
  font-weight: 700;
}
.action-lane {
  height: 34px;
}
.action-marker {
  position: absolute;
  top: 5px;
  width: 25px;
  height: 25px;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 2px solid #20272c;
  background: #fff4db;
  font: 800 11px var(--display);
  z-index: 4;
}
.action-marker[data-mode='order'] {
  border-radius: 4px;
}
.action-marker[data-verdict='effective'] {
  background: #2f7d55;
  border-color: #17492f;
  color: white;
}
.action-marker[data-verdict='waiting'],
.action-marker[data-verdict='supported'] {
  background: #ffd455;
  border-color: #9a7612;
}
.action-marker[data-verdict='missed'],
.action-marker[data-verdict='validated-late'] {
  background: #a33d27;
  border-color: #672415;
  color: white;
}
.action-marker[data-verdict='wrong'],
.action-marker[data-verdict='invalid'] {
  background: #777461;
  border-color: #3d3c32;
  color: white;
}
.action-marker[data-scripted='true'] {
  box-shadow: 0 0 0 2px #f8f2df, 0 0 0 3px #8c866e;
}
.empty-actions {
  position: absolute;
  left: 8px;
  top: 8px;
  color: #8a8067;
  font-size: 11px;
}
@media (max-width: 700px) {
  .tl-inner {
    min-width: 720px;
  }
}
</style>
