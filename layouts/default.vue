<!--
  layouts/default.vue
  LNB(256px) + 본문(TopBar + content).
-->
<template>
  <div class="flex min-h-screen bg-slate-50">
    <AdminSidebarMenu />
    <div class="flex min-w-0 flex-1 flex-col">
      <AdminTopBar />
      <main class="flex-1 px-6 py-6">
        <slot />
      </main>
    </div>
  </div>
</template>
