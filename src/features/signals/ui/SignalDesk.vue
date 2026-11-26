<script setup lang="ts">
import { Anchor, Flag } from 'lucide-vue-next'
import SignalScenario from './SignalScenario.vue'
import { signalScenarios } from '../model/signals'
</script>

<template>
  <section class="signal-desk" aria-label="岸台旗号限时转向判读" data-testid="signal-desk">
    <header class="desk-header">
      <div class="desk-title">
        <Flag :size="23" />
        <div>
          <h2>岸台旗号 · 分组证据与限时转向</h2>
          <p>
            两组交接时，重叠颜色可能拼成从未发出的命令。每个解释都按来源旗的可见时段绘回时间轴；
            猜测可以先操舵，只有证据足以辨认且在截止前完成的有效响应才改变下一门线。
          </p>
        </div>
      </div>
      <nav class="scenario-anchors" aria-label="跳转到旗号案例">
        <a v-for="item in signalScenarios" :key="item.id" :href="`#signal-scenario-${item.id}`" :data-testid="`signal-nav-${item.id}`">
          <Anchor :size="14" />{{ item.tab }}
        </a>
      </nav>
    </header>

    <SignalScenario v-for="item in signalScenarios" :key="item.id" :scenario="item" />
  </section>
</template>

<style scoped>
.signal-desk {
  margin-top: 18px;
  padding: 16px 18px 18px;
  background: var(--paper);
  border: 1px solid var(--rule);
}
.desk-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.desk-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: min(520px, 100%);
}
.desk-title > svg {
  color: #31585a;
  margin-top: 2px;
  flex: none;
}
.desk-title h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
}
.desk-title p {
  margin: 6px 0 0;
  color: #5f6254;
  font-size: 13px;
  line-height: 1.6;
}
.scenario-anchors {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.scenario-anchors a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #31585a;
  background: #31585a;
  color: #fff4db;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}
.scenario-anchors a:hover {
  background: #3f7072;
}
@media (max-width: 640px) {
  .signal-desk {
    padding: 12px 10px;
  }
  .desk-title h2 {
    font-size: 19px;
  }
}
</style>
