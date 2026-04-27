<template>
  <nav class="global-navbar">
    <div class="navbar-left">
      <NuxtLink to="/" class="logo">
        Nuxt Task
      </NuxtLink>
    </div>
    <div class="navbar-right">
      <template v-if="isAuthenticated && user">
        <NuxtLink to="/tasks" class="nav-link">任务管理</NuxtLink>
        <NuxtLink to="/profile" class="user-info">
          <div class="user-avatar">
            <template v-if="userAvatar && !avatarError">
              <img
                :src="userAvatar"
                :key="userAvatar"
                alt="Avatar"
                class="avatar-img"
                @error="handleAvatarError"
              />
            </template>
            <template v-else>
              <span class="avatar-initial">{{ userInitials }}</span>
            </template>
          </div>
          <span class="username">{{ user.username }}</span>
        </NuxtLink>
        <button @click="handleLogout" class="nav-link logout-btn">
          登出
        </button>
      </template>
      <template v-else>
        <NuxtLink to="/login" class="nav-link">登录</NuxtLink>
        <NuxtLink to="/register" class="nav-link primary">注册</NuxtLink>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
const { isAuthenticated, user, logout, initAuth } = useAuth()
const router = useRouter()

const avatarError = ref(false)

const userAvatar = computed(() => {
  return user.value?.avatar || null
})

const userInitials = computed(() => {
  if (user.value?.username) {
    return user.value.username.charAt(0).toUpperCase()
  }
  return '?'
})

watch(
  () => user.value?.avatar,
  () => {
    avatarError.value = false
  }
)

onMounted(() => {
  initAuth()
})

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

const handleAvatarError = () => {
  avatarError.value = true
}
</script>

<style scoped>
.global-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(135deg, #00dc82 0%, #00c471 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  text-decoration: none;
  transition: opacity 0.2s;
}

.logo:hover {
  opacity: 0.9;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  color: white;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.15);
}

.nav-link.primary {
  background: white;
  color: #00dc82;
  border-color: white;
}

.nav-link.primary:hover {
  background: rgba(255, 255, 255, 0.9);
}

.user-info {
  display: inline-flex;
  align-items: center;
  color: white;
  font-size: 0.9rem;
  padding: 0.35rem 0.75rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  gap: 0.5rem;
  text-decoration: none;
  transition: all 0.2s;
}

.user-info:hover {
  background: rgba(255, 255, 255, 0.25);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initial {
  font-size: 0.85rem;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.username {
  font-weight: 600;
}

.logout-btn {
  border-color: rgba(255, 255, 255, 0.5);
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 600px) {
  .global-navbar {
    padding: 0 1rem;
  }

  .logo {
    font-size: 1.1rem;
  }

  .navbar-right {
    gap: 0.5rem;
  }

  .nav-link {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
  }

  .user-info {
    padding: 0.3rem;
  }

  .user-info .username {
    display: none;
  }
}
</style>
