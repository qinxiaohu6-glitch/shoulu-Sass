<script setup lang="ts">
/**
 * The frame every auth page shares.
 *
 * `welcome` is the public sign-in / sign-up shell: a dark benefits card beside
 * a white account card. The other auth pages (password reset, invite) keep the
 * original centred card so a flow that is not a sign-in does not grow a pitch.
 *
 * Sign-in stays on `layout: false`, so the icon sprite is mounted here.
 */
const props = defineProps<{
  title: string
  description?: string
  welcome?: boolean
  hero?: string
  lead?: string
}>()

const { pick, isZh, setLocale } = useLang()
const localePath = useLocalePath()

const points = computed(() => [
  {
    title: pick('一个会留下来的目录页', 'A listing page that stays up'),
    body: pick(
      '页面留在目录里。这不是到期就撤掉的租位。',
      'The page stays in the directory. It is not a rental that expires.',
    ),
  },
  {
    title: pick('付费位置一次付清', 'Paid placement is one payment'),
    body: pick(
      '付费收录和 Billboard 都是一次性的，不会自动续费。',
      'Paid listings and Billboard are one-time. Nothing renews by itself.',
    ),
  },
  {
    title: pick('付款成功后自动发布', 'Published when payment succeeds'),
    body: pick(
      '验签后的支付回调完成订单并发布页面，不用人工确认收款。',
      'A verified payment webhook settles the order and publishes the page.',
    ),
  },
])

async function switchLang() {
  await setLocale(isZh.value ? 'en' : 'zh')
}
</script>

<template>
  <div v-if="props.welcome" class="auth-welcome">
    <IconSprite />
    <header class="auth-welcome__bar">
      <NuxtLink class="auth-welcome__brand" :to="localePath('/')">
        <img src="/assets/img/brand/logo.png" alt="" width="28" height="28">
        <span>Product Atlas</span>
      </NuxtLink>
      <button class="auth-welcome__lang" type="button" @click="switchLang">
        {{ isZh ? 'English' : '中文' }}
      </button>
    </header>

    <div class="auth-welcome__stage">
      <section class="auth-welcome__story" :aria-label="pick('免费账号', 'Free account')">
        <p class="auth-welcome__eyebrow">
          <span class="auth-welcome__dot" aria-hidden="true" />
          {{ pick('免费账号', 'Free account') }}
        </p>
        <h1>{{ props.hero }}</h1>
        <p class="auth-welcome__lead">{{ props.lead }}</p>
        <ul class="auth-welcome__points">
          <li v-for="point in points" :key="point.title">
            <span class="auth-welcome__icon" aria-hidden="true">
              <Icon name="check" :size="16" />
            </span>
            <span>
              <strong>{{ point.title }}</strong>
              <small>{{ point.body }}</small>
            </span>
          </li>
        </ul>
        <p class="auth-welcome__proof">
          {{ pick('免费开始。这一页不需要银行卡。', 'Free to start. No card needed.') }}
        </p>
        <p class="auth-welcome__fine">
          {{ pick('不承诺排名、流量或域名权重。', 'No promise of rankings, traffic, or domain authority.') }}
        </p>
      </section>

      <section class="auth-welcome__card">
        <h2>{{ props.title }}</h2>
        <p v-if="props.description" class="auth-welcome__desc">{{ props.description }}</p>
        <div class="auth-welcome__slot">
          <slot />
        </div>
      </section>
    </div>
  </div>

  <div v-else class="src-page flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
    <IconSprite />

    <div class="flex w-full max-w-sm flex-col gap-6">
      <NuxtLink :to="localePath('/')" class="self-center">
        <span class="flex items-center gap-2">
          <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28">
          <span class="text-lg font-semibold tracking-tight">Product Atlas</span>
        </span>
      </NuxtLink>

      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col gap-1.5 p-6 text-center">
          <h1 class="text-xl font-semibold leading-none tracking-tight">{{ title }}</h1>
          <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
        </div>
        <div class="p-6 pt-0">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-welcome {
  min-height: 100vh;
  color: #1c1917;
  background-color: #f4f1ea;
  background-image:
    linear-gradient(to right, rgba(28, 25, 23, 0.045) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(28, 25, 23, 0.045) 1px, transparent 1px);
  background-size: 32px 32px;
}
.auth-welcome__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1080px;
  margin: 0 auto;
  padding: 22px 20px 0;
}
.auth-welcome__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #1c1917;
}
.auth-welcome__brand img {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.auth-welcome__lang {
  border: 0;
  background: transparent;
  color: #57534e;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.auth-welcome__stage {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(280px, 0.92fr);
  gap: 22px;
  max-width: 1040px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  align-items: stretch;
}
.auth-welcome__story {
  display: flex;
  flex-direction: column;
  min-height: 560px;
  padding: 36px 36px 28px;
  border-radius: 28px;
  color: #faf7f2;
  background:
    radial-gradient(90% 70% at 0% 0%, rgba(232, 184, 74, 0.22), transparent 46%),
    linear-gradient(165deg, #2a261f 0%, #141414 46%, #0c0c0c 100%);
  box-shadow: 0 24px 60px rgba(20, 16, 12, 0.18);
}
.auth-welcome__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #e8b84a;
}
.auth-welcome__dot {
  width: 7px;
  height: 7px;
  border-radius: 99px;
  background: #e8b84a;
}
.auth-welcome__story h1 {
  margin: 18px 0 0;
  max-width: 12ch;
  font-size: 46px;
  line-height: 1.02;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: #fff;
}
.auth-welcome__lead {
  margin: 16px 0 0;
  max-width: 38ch;
  font-size: 15.5px;
  line-height: 1.55;
  color: rgba(250, 247, 242, 0.78);
}
.auth-welcome__points {
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.auth-welcome__points li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.auth-welcome__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 12px;
  color: #e8b84a;
  background: rgba(255, 255, 255, 0.06);
}
.auth-welcome__points strong {
  display: block;
  font-size: 15px;
  font-weight: 650;
  color: #fff;
}
.auth-welcome__points small {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(250, 247, 242, 0.62);
}
.auth-welcome__proof {
  margin: auto 0 0;
  padding-top: 28px;
  font-size: 14px;
  font-weight: 650;
  color: #fff;
}
.auth-welcome__fine {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(250, 247, 242, 0.48);
}
.auth-welcome__card {
  display: flex;
  flex-direction: column;
  padding: 36px 32px;
  border-radius: 28px;
  background: #fff;
  border: 1px solid rgba(28, 25, 23, 0.06);
  box-shadow: 0 18px 50px rgba(28, 25, 23, 0.08);
}
.auth-welcome__card h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.auth-welcome__desc {
  margin: 8px 0 0;
  font-size: 14.5px;
  line-height: 1.5;
  color: #78716c;
}
.auth-welcome__slot {
  margin-top: 22px;
}
@media (max-width: 860px) {
  .auth-welcome__stage {
    grid-template-columns: 1fr;
    padding-top: 18px;
  }
  .auth-welcome__story {
    min-height: 0;
    padding: 28px 22px 22px;
    border-radius: 24px;
  }
  .auth-welcome__story h1 {
    font-size: 34px;
    max-width: 14ch;
  }
  .auth-welcome__points,
  .auth-welcome__fine {
    display: none;
  }
  .auth-welcome__proof {
    margin-top: 18px;
    padding-top: 0;
  }
  .auth-welcome__card {
    padding: 28px 20px 24px;
    border-radius: 24px;
  }
  .auth-welcome__card h2 {
    font-size: 26px;
  }
}
</style>
