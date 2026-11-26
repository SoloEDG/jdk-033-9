export type FlagColor = 'R' | 'Y' | 'B' | 'G'
export type HelmSide = 'port' | 'starboard'
export type BoundaryVisibility = 'clear' | 'hidden' | 'late'
export type InterpretationValidity = 'confirmed' | 'late-confirmed' | 'rejected' | 'open'

export interface PointLike {
  x: number
  y: number
}

export interface Command {
  id: string
  code: FlagColor[]
  label: string
  helm: HelmSide
  gateName: string
  gate: { a: PointLike; b: PointLike }
}

export interface SignalGroup {
  id: 'A' | 'B'
  code: FlagColor[]
  hoist: number
  gone: number
  commandId: string
}

export interface FlagState {
  id: string
  groupId: SignalGroup['id']
  color: FlagColor
  hoist: number
  clearAt: number
  lowerAt: number
  goneAt: number
}

export interface FlagObservation {
  id: string
  color: FlagColor
  from: number
  to: number
  hoistBoundaryAt?: number
  lowerBoundaryAt?: number
}

export interface Interpretation {
  id: string
  trackId: string
  code: FlagColor[]
  name: string
  detail: string
  sourceText: string
  from: number
  to: number
  assembledAt: number
  certifiedAt: number | null
  resolvedAt?: number
  validity: InterpretationValidity
  commandId?: string
  overlap?: { from: number; to: number }
}

export interface SignalTrack {
  id: string
  name: string
  vantage: string
  boundary: BoundaryVisibility
  boundaryLabel: string
  observations: FlagObservation[]
  certifiedAt: number | null
  commandId?: string
  interpretations: Interpretation[]
}

export type ActionMode = 'guess' | 'order'

export interface SignalAction {
  id: string
  at: number
  side: HelmSide
  mode: ActionMode
  scripted?: boolean
}

export interface SignalScenario {
  id: string
  tab: string
  title: string
  premise: string
  duration: number
  deadline: number
  initialTime: number
  initialTrackId: string
  groups: SignalGroup[]
  flags: FlagState[]
  tracks: SignalTrack[]
  scripted: Record<string, SignalAction[]>
}

export const COLOR_NAME: Record<FlagColor, string> = {
  R: '赤',
  Y: '黄',
  B: '蓝',
  G: '绿',
}

export const SIDE_NAME: Record<HelmSide, string> = {
  port: '左舵',
  starboard: '右舵',
}

export const COMMANDS: Record<string, Command> = {
  RY: {
    id: 'RY',
    code: ['R', 'Y'],
    label: '赤黄 · 左舵走北门',
    helm: 'port',
    gateName: '下一门线北移',
    gate: { a: { x: 178, y: 54 }, b: { x: 252, y: 151 } },
  },
  BG: {
    id: 'BG',
    code: ['B', 'G'],
    label: '蓝绿 · 右舵走东线',
    helm: 'starboard',
    gateName: '下一门线东移',
    gate: { a: { x: 246, y: 82 }, b: { x: 322, y: 178 } },
  },
}

const commonObservations: FlagObservation[] = [
  { id: 'r', color: 'R', from: 1.9, to: 7.2 },
  { id: 'y', color: 'Y', from: 3.7, to: 8.4 },
  { id: 'b', color: 'B', from: 6.6, to: 13.0 },
  { id: 'g', color: 'G', from: 9.1, to: 14.4 },
]

const clearObservations: FlagObservation[] = commonObservations.map((item) => {
  if (item.id === 'r') return { ...item, hoistBoundaryAt: 1.1, lowerBoundaryAt: 6.0 }
  if (item.id === 'y') return { ...item, hoistBoundaryAt: 2.9, lowerBoundaryAt: 6.0 }
  return { ...item, hoistBoundaryAt: item.id === 'b' ? 5.9 : 8.4 }
})

export const signalScenarios: SignalScenario[] = [
  {
    id: 'same-colors-two-boundaries',
    tab: '同色双航迹',
    title: '同样的 R–Y–B，不同的分组证据',
    premise:
      '旧令赤黄尚未降完，蓝旗已作为新令升起；6.6–7.2 三色同时可见。近岸航迹看得见升、降边界，外舷航迹只录得同序颜色。',
    duration: 15,
    deadline: 8.6,
    initialTime: 10.2,
    initialTrackId: 'clear-a',
    groups: [
      { id: 'A', code: ['R', 'Y'], hoist: 1.1, gone: 8.4, commandId: 'RY' },
      { id: 'B', code: ['B', 'G'], hoist: 5.9, gone: 14.4, commandId: 'BG' },
    ],
    flags: [
      { id: 'r', groupId: 'A', color: 'R', hoist: 1.1, clearAt: 1.9, lowerAt: 6.0, goneAt: 7.2 },
      { id: 'y', groupId: 'A', color: 'Y', hoist: 2.9, clearAt: 3.7, lowerAt: 6.0, goneAt: 8.4 },
      { id: 'b', groupId: 'B', color: 'B', hoist: 5.9, clearAt: 6.6, lowerAt: 11.8, goneAt: 13.0 },
      { id: 'g', groupId: 'B', color: 'G', hoist: 8.4, clearAt: 9.1, lowerAt: 13.2, goneAt: 14.4 },
    ],
    tracks: [
      {
        id: 'clear-a',
        name: '近岸航迹 A',
        vantage: '无帆影遮挡，可见同一托架的升起、回落和新索升起。',
        boundary: 'clear',
        boundaryLabel: '升降边界可见',
        observations: clearObservations,
        certifiedAt: 3.7,
        commandId: 'RY',
        interpretations: [
          {
            id: 'a-ry',
            trackId: 'clear-a',
            code: ['R', 'Y'],
            name: '同组真令 RY',
            detail: '赤、黄先后露出，但升架与降沿连续指向 A 组；黄旗露出时即可合读为左舵北门线。',
            sourceText: '赤 1.9–7.2s；黄 3.7–8.4s；同组边界 1.1–8.4s',
            from: 1.9,
            to: 8.4,
            assembledAt: 3.7,
            certifiedAt: 3.7,
            validity: 'confirmed',
            commandId: 'RY',
          },
          {
            id: 'a-ryb',
            trackId: 'clear-a',
            code: ['R', 'Y', 'B'],
            name: '交接伪拼 RYB',
            detail: '三色确曾同时展示，但边界显示 R/Y 属于正在降的 A 组，B 属于刚升起的 B 组；电码中没有这条跨组令。',
            sourceText: '赤 1.9–7.2s + 黄 3.7–8.4s + 蓝 6.6–13.0s',
            from: 1.9,
            to: 13.0,
            assembledAt: 6.6,
            certifiedAt: null,
            resolvedAt: 6.6,
            validity: 'rejected',
            overlap: { from: 6.6, to: 7.2 },
          },
          {
            id: 'a-bg',
            trackId: 'clear-a',
            code: ['B', 'G'],
            name: '新组真令 BG',
            detail: '蓝、绿由新索先后升起，应另开一个观测组，不能向前接上旧组的赤旗。',
            sourceText: '蓝 6.6–13.0s；绿 9.1–14.4s；B 组边界 5.9–14.4s',
            from: 6.6,
            to: 14.4,
            assembledAt: 9.1,
            certifiedAt: 9.1,
            validity: 'confirmed',
            commandId: 'BG',
          },
        ],
      },
      {
        id: 'hidden-b',
        name: '外舷航迹 B',
        vantage: '前帆恰好遮住桁端和索扣，只看到同序颜色，看不到升降边界。',
        boundary: 'hidden',
        boundaryLabel: '升降边界缺失',
        observations: commonObservations,
        certifiedAt: null,
        interpretations: [
          {
            id: 'b-ry',
            trackId: 'hidden-b',
            code: ['R', 'Y'],
            name: '可能：同组 RY',
            detail: '颜色片段允许把赤、黄读作一组，但没有同组升降边界，不能排除赤是上一组残留。',
            sourceText: '赤 1.9–7.2s；黄 3.7–8.4s；边界未见到',
            from: 1.9,
            to: 8.4,
            assembledAt: 3.7,
            certifiedAt: null,
            validity: 'open',
            commandId: 'RY',
          },
          {
            id: 'b-ryb',
            trackId: 'hidden-b',
            code: ['R', 'Y', 'B'],
            name: '危险：跨组 RYB',
            detail: '录得与 A 相同的 R–Y–B 顺序，却无法判断黄是旧组尾还是中间旗；若直接合读，就会接受从未发出的命令。',
            sourceText: '赤 1.9–7.2s + 黄 3.7–8.4s + 蓝 6.6–13.0s',
            from: 1.9,
            to: 13.0,
            assembledAt: 6.6,
            certifiedAt: null,
            validity: 'open',
            overlap: { from: 6.6, to: 7.2 },
          },
          {
            id: 'b-yb',
            trackId: 'hidden-b',
            code: ['Y', 'B'],
            name: '也可能：旧尾接新头',
            detail: '黄可能是 A 组尚未降完的尾旗，蓝是 B 组的头旗；缺少边界时，这一解释与 RY 同样可用。',
            sourceText: '黄 3.7–8.4s + 蓝 6.6–13.0s；跨组关系未证实',
            from: 3.7,
            to: 13.0,
            assembledAt: 6.6,
            certifiedAt: null,
            validity: 'open',
          },
        ],
      },
    ],
    scripted: {
      'clear-a': [
        { id: 'a-guess', at: 2.7, side: 'port', mode: 'guess', scripted: true },
        { id: 'a-order', at: 5.2, side: 'port', mode: 'order', scripted: true },
      ],
      'hidden-b': [{ id: 'b-guess', at: 6.9, side: 'port', mode: 'guess', scripted: true }],
    },
  },
  {
    id: 'late-boundary',
    tab: '迟到才可辨',
    title: '边界在截止后才补上',
    premise:
      '西口航迹被逆光和帆影遮住索扣。颜色早就能拼出 RY，但同组边界直到 9.7s 才确认；响应截止为 8.0s。先猜左舵可以操船，却不能在截止前改下一门线。',
    duration: 13.2,
    deadline: 8.0,
    initialTime: 11.6,
    initialTrackId: 'late-c',
    groups: [{ id: 'A', code: ['R', 'Y'], hoist: 1.2, gone: 9.5, commandId: 'RY' }],
    flags: [
      { id: 'late-r', groupId: 'A', color: 'R', hoist: 1.2, clearAt: 2.0, lowerAt: 6.2, goneAt: 7.4 },
      { id: 'late-y', groupId: 'A', color: 'Y', hoist: 3.0, clearAt: 3.9, lowerAt: 7.8, goneAt: 9.5 },
      { id: 'late-b', groupId: 'B', color: 'B', hoist: 5.8, clearAt: 6.5, lowerAt: 11.2, goneAt: 12.6 },
    ],
    tracks: [
      {
        id: 'late-c',
        name: '西口航迹 C',
        vantage: '颜色清楚，但升降边界被逆光吞没；直到黄旗降沿离开桁端才取得同组证据。',
        boundary: 'late',
        boundaryLabel: '9.7s 才见到完整边界',
        observations: [
          { id: 'late-r', color: 'R', from: 2.0, to: 7.4 },
          { id: 'late-y', color: 'Y', from: 3.9, to: 9.5 },
          { id: 'late-b', color: 'B', from: 6.5, to: 12.6 },
        ],
        certifiedAt: 9.7,
        commandId: 'RY',
        interpretations: [
          {
            id: 'c-ry',
            trackId: 'late-c',
            code: ['R', 'Y'],
            name: '迟到确认 RY',
            detail: 'RY 很可能为真，左舵猜测也正确；但 9.7s 才看见足以证明同组的升降边界，此时 8.0s 响应截止已过。',
            sourceText: '赤 2.0–7.4s；黄 3.9–9.5s；完整边界至 9.7s',
            from: 2.0,
            to: 9.7,
            assembledAt: 3.9,
            certifiedAt: 9.7,
            validity: 'late-confirmed',
            commandId: 'RY',
          },
          {
            id: 'c-ryb',
            trackId: 'late-c',
            code: ['R', 'Y', 'B'],
            name: '截止前无法排除 RYB',
            detail: '6.5s 后蓝旗进入视野。截止时仍不能证明黄与赤同组、或黄与蓝跨组；该解释到 9.7s 才被边界否定。',
            sourceText: '赤 2.0–7.4s + 黄 3.9–9.5s + 蓝 6.5–12.6s',
            from: 2.0,
            to: 12.6,
            assembledAt: 6.5,
            certifiedAt: null,
            resolvedAt: 9.7,
            validity: 'rejected',
            overlap: { from: 6.5, to: 7.4 },
          },
        ],
      },
    ],
    scripted: {
      'late-c': [{ id: 'c-guess', at: 5.3, side: 'port', mode: 'guess', scripted: true }],
    },
  },
]

const EPS = 0.001

export function timePercent(time: number, duration: number): number {
  return Math.max(0, Math.min(100, (time / duration) * 100))
}

export function commandForTrack(track: SignalTrack): Command | null {
  return track.commandId ? COMMANDS[track.commandId] ?? null : null
}

export function interpretationCommand(item: Interpretation): Command | null {
  return item.commandId ? COMMANDS[item.commandId] ?? null : null
}

export type ActionVerdict =
  | 'future'
  | 'effective'
  | 'supported'
  | 'validated-late'
  | 'waiting'
  | 'wrong'
  | 'missed'
  | 'invalid'

export interface ActionState {
  action: SignalAction
  visible: boolean
  verdict: ActionVerdict
  headline: string
  detail: string
  effectiveAt: number | null
}

export function describeAction(
  action: SignalAction,
  scenario: SignalScenario,
  track: SignalTrack,
  now: number,
): ActionState {
  const command = commandForTrack(track)
  const certifiedAt = track.certifiedAt
  const visible = action.at <= now + EPS
  const matches = command ? action.side === command.helm : false

  if (!visible) {
    return {
      action,
      visible: false,
      verdict: 'future',
      headline: '尚未发生',
      detail: `计划在 ${action.at.toFixed(1)}s ${SIDE_NAME[action.side]}。`,
      effectiveAt: null,
    }
  }

  if (action.mode === 'order') {
    if (certifiedAt === null || action.at < certifiedAt - EPS) {
      return {
        action,
        visible: true,
        verdict: 'invalid',
        headline: '证据不足，不能改线',
        detail: '这声舵令发出时，同组边界尚未确认。',
        effectiveAt: null,
      }
    }
    if (action.at > scenario.deadline + EPS) {
      return {
        action,
        visible: true,
        verdict: 'missed',
        headline: '已过响应截止',
        detail: `辨认完成于 ${certifiedAt.toFixed(1)}s，但舵令晚于 ${scenario.deadline.toFixed(1)}s 截止线。`,
        effectiveAt: null,
      }
    }
    if (!matches) {
      return {
        action,
        visible: true,
        verdict: 'wrong',
        headline: '舵向与确认命令不符',
        detail: `确认命令要求${command ? SIDE_NAME[command.helm] : '等待'}。`,
        effectiveAt: null,
      }
    }
    return {
      action,
      visible: true,
      verdict: 'effective',
      headline: '证据舵令有效，门线已改',
      detail: `${certifiedAt.toFixed(1)}s 已完成辨认，${action.at.toFixed(1)}s 的响应在 ${scenario.deadline.toFixed(1)}s 前。`,
      effectiveAt: action.at,
    }
  }

  if (certifiedAt !== null && now >= certifiedAt - EPS) {
    if (certifiedAt > scenario.deadline + EPS) {
      return {
        action,
        visible: true,
        verdict: 'validated-late',
        headline: '猜对了，但辨认迟到',
        detail: `${certifiedAt.toFixed(1)}s 才确认同组；${scenario.deadline.toFixed(1)}s 响应截止已过，只能保留航迹后果，不能改下一门线。`,
        effectiveAt: null,
      }
    }
    if (!matches) {
      return {
        action,
        visible: true,
        verdict: 'wrong',
        headline: '猜测方向错误',
        detail: `证据确认的是${command?.label ?? '另一命令'}；这一操舵不获得门线效力。`,
        effectiveAt: null,
      }
    }
    if (action.at > scenario.deadline + EPS) {
      return {
        action,
        visible: true,
        verdict: 'missed',
        headline: '猜测发生在截止后',
        detail: '虽然命令随后确认，操舵时间已经错过响应窗口。',
        effectiveAt: null,
      }
    }
    return {
      action,
      visible: true,
      verdict: 'supported',
      headline: '猜测方向已被证据支持',
      detail: `${certifiedAt.toFixed(1)}s 边界已在截止前补足；但先行猜测不直接改线，需在 ${scenario.deadline.toFixed(1)}s 前再记录一道证据舵令或追认当前舵角。`,
      effectiveAt: null,
    }
  }

  if (now > scenario.deadline + EPS) {
    return {
      action,
      visible: true,
      verdict: 'missed',
      headline: certifiedAt === null ? '截止时仍不可辨' : '响应截止已过',
      detail:
        certifiedAt === null
          ? '同组边界始终未出现；颜色顺序不足以把响应变成门线变更。'
          : `截止时证据尚未补足，完整边界要到 ${certifiedAt.toFixed(1)}s。`,
      effectiveAt: null,
    }
  }

  return {
    action,
    visible: true,
    verdict: 'waiting',
    headline: '仅为猜测操舵',
    detail: '船可以先按此操舵，但在同组边界确认且未过截止前，下一门线保持原状。',
    effectiveAt: null,
  }
}

export interface GateState {
  changed: boolean
  side: HelmSide | null
  provisional: boolean
  effectiveAt: number | null
  command: Command | null
  latestAction: SignalAction | null
}

export function gateStateAt(
  scenario: SignalScenario,
  track: SignalTrack,
  actions: SignalAction[],
  now: number,
): GateState {
  const states = actions
    .map((action) => describeAction(action, scenario, track, now))
    .filter((state) => state.visible)
  const effective = states
    .filter((state) => state.verdict === 'effective' && state.effectiveAt !== null && now >= state.effectiveAt - EPS)
    .sort((a, b) => (b.effectiveAt ?? 0) - (a.effectiveAt ?? 0))[0]

  const visibleActions = actions.filter((action) => action.at <= now + EPS).sort((a, b) => b.at - a.at)
  const latestAction = visibleActions[0] ?? null
  const command = commandForTrack(track)

  if (effective) {
    return {
      changed: true,
      side: effective.action.side,
      provisional: false,
      effectiveAt: effective.effectiveAt,
      command,
      latestAction,
    }
  }

  return {
    changed: false,
    side: latestAction?.side ?? null,
    provisional: latestAction !== null,
    effectiveAt: null,
    command,
    latestAction,
  }
}
