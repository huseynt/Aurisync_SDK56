import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <StatusBar style="auto" />

      <View className="flex-1 px-8 justify-between py-16">

        {/* Header */}
        <View>
          <Text className="text-sm font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-500">
            Aurisync
          </Text>
          <Text className="text-4xl font-bold mt-3 leading-tight text-zinc-900 dark:text-white">
            Real-time{"\n"}audio stream
          </Text>
          <Text className="text-base mt-3 text-zinc-400 dark:text-zinc-500">
            P2P audio — low latency, no middleman.
          </Text>
        </View>

        {/* Buttons */}
        <View className="gap-4">
          <Pressable
            onPress={() => router.push("/sender")}
            className="rounded-2xl px-6 py-5 active:opacity-70 bg-zinc-900 dark:bg-white"
          >
            <Text className="text-lg font-semibold text-white dark:text-zinc-950">
              Send Audio
            </Text>
            <Text className="text-sm mt-1 text-zinc-400 dark:text-zinc-500">
              Stream your microphone
            </Text>
          </Pressable>
    
          <Pressable
            onPress={() => router.push("/receiver")}
            className="rounded-2xl px-6 py-5 active:opacity-70 border bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
          >
            <Text className="text-lg font-semibold text-zinc-900 dark:text-white">
              Receive Audio
            </Text>
            <Text className="text-sm mt-1 text-zinc-400 dark:text-zinc-600">
              Listen via PIN code
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text className="text-xs text-center text-zinc-400 dark:text-zinc-700">
          WebRTC · End-to-end · No recording
        </Text>

      </View>
    </SafeAreaView>
  );
}