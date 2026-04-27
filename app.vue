<template>
  <div class="app-container">
    <AppNavbar />
    <main class="main-content">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.main-content {
  padding-top: 60px;
  min-height: 100vh;
}
</style>
