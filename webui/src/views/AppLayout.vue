<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    LayoutDashboard,
    ListTodo,
    Bot,
    Trophy,
    ScrollText,
    Star,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const sidebarCollapsed = ref(false)

const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, label: 'Панель' },
    { name: 'Tasks', path: '/tasks', icon: ListTodo, label: 'Задачи' },
    { name: 'Agents', path: '/agents', icon: Bot, label: 'Агенты' },
    { name: 'Scores', path: '/scores', icon: Trophy, label: 'Рейтинг' },
    { name: 'Logs', path: '/logs', icon: ScrollText, label: 'Логи' },
    { name: 'Reviews', path: '/reviews', icon: Star, label: 'Рецензии' },
    { name: 'Prompts', path: '/prompts', icon: ListTodo, label: 'Промпты' },
    { name: 'Settings', path: '/settings', icon: Settings, label: 'Настройки' },
]

function isActive(path: string) {
    return route.path === path || route.path.startsWith(path + '/')
}

function logout() {
    auth.logout()
    router.push('/login')
}

onMounted(() => {
    // startCheckActivity()
})
</script>

<template>
    <div class="flex h-screen overflow-hidden bg-background">
        <!-- Боковая панель -->
        <aside
            class="relative flex flex-col border-r border-border/40 bg-background transition-all duration-300 shrink-0"
            :class="sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'">

            <!-- Логотип -->
            <div class="flex items-center h-14 px-4 border-b border-border/40 shrink-0">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div
                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                        M
                    </div>
                    <Transition name="fade">
                        <span v-if="!sidebarCollapsed"
                            class="text-sm font-semibold truncate">OpenMOSS</span>
                    </Transition>
                </div>
            </div>

            <!-- Навигация -->
            <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                <template v-for="item in navItems" :key="item.path">
                    <div v-if="item.name === 'Prompts'" class="pt-2">
                        <Separator class="mb-2 opacity-30" />
                        <span v-if="!sidebarCollapsed"
                            class="px-3 mb-1 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
                            Система
                        </span>
                    </div>
                    <RouterLink :to="item.path">
                        <Button variant="ghost" class="w-full justify-start gap-2.5 h-9 px-2.5"
                            :class="[
                                isActive(item.path) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                                sidebarCollapsed ? 'justify-center px-0' : ''
                            ]">
                            <component :is="item.icon" class="h-4 w-4 shrink-0"
                                :class="isActive(item.path) ? 'text-accent-foreground' : ''" />
                            <Transition name="fade">
                                <span v-if="!sidebarCollapsed"
                                    class="text-sm truncate">{{ item.label }}</span>
                            </Transition>
                        </Button>
                    </RouterLink>
                </template>
            </nav>

            <!-- Нижняя часть: сворачивание + выход -->
            <div class="border-t border-border/40 p-2 space-y-1 shrink-0">
                <Button variant="ghost" class="w-full justify-start gap-2 h-9 px-2.5 text-muted-foreground"
                    :class="sidebarCollapsed ? 'justify-center px-0' : ''" @click="sidebarCollapsed = !sidebarCollapsed">
                    <component :is="sidebarCollapsed ? ChevronRight : ChevronLeft" class="h-4 w-4" />
                    <Transition name="fade">
                        <span v-if="!sidebarCollapsed" class="text-sm">Свернуть</span>
                    </Transition>
                </Button>
                <Button variant="ghost" class="w-full justify-start gap-2 h-9 px-2.5 text-muted-foreground hover:text-foreground"
                    :class="sidebarCollapsed ? 'justify-center px-0' : ''" @click="logout">
                    <LogOut class="h-4 w-4" />
                    <Transition name="fade">
                        <span v-if="!sidebarCollapsed" class="text-sm">Выйти</span>
                    </Transition>
                </Button>
            </div>
        </aside>

        <!-- Основной контент -->
        <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
            <main class="flex-1 overflow-y-auto">
                <RouterView />
            </main>
        </div>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
