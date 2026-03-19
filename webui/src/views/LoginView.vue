<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
    if (!password.value) {
        error.value = 'Введите пароль'
        return
    }
    loading.value = true
    error.value = ''
    try {
        await auth.login(password.value)
        const redirect = new URLSearchParams(window.location.search).get('redirect')
        router.push(redirect || '/')
    } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } }
        error.value = err.response?.data?.detail || 'Неверный пароль'
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-background p-4">
        <Card class="w-full max-w-sm">
            <CardHeader class="text-center">
                <div
                    class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
                    M
                </div>
                <CardTitle class="text-2xl">Вход в OpenMOSS</CardTitle>
                <CardDescription>Введите пароль администратора</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="space-y-2">
                    <Label for="password">Пароль</Label>
                    <Input id="password" v-model="password" type="password" placeholder="Введите пароль"
                        @keyup.enter="handleLogin" />
                </div>
                <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
                <Button class="w-full" :disabled="loading" @click="handleLogin">
                    <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
                    Войти
                </Button>
            </CardContent>
        </Card>
    </div>
</template>
