import { View, Text, TextInput, Pressable, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function SenderScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  const [serverUrl, setServerUrl] = useState("ws://192.168.1.100:8080");

  const { status, pin, error, createRoom, disconnect } = useWebRTC({ role: "sender" });

  const statusConfig = {
    idle:       { label: "Ready",                  color: dark ? "text-zinc-500" : "text-zinc-400" },
    connecting: { label: "Connecting...",           color: "text-yellow-500" },
    waiting:    { label: "Waiting for receiver...", color: "text-blue-500" },
    live:       { label: "Live",                    color: "text-emerald-500" },
    error:      { label: "Error",                   color: "text-red-500" },
    receiving:  { label: "Receiving",               color: "text-emerald-500" },
  };

  const isActive = status !== "idle" && status !== "error";

  return (
    <SafeAreaView className={`flex-1 ${dark ? "bg-zinc-950" : "bg-zinc-50"}`}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      <View className="flex-1 px-6 pt-4">

        {/* Header */}
        <View className="flex-row items-center mb-10">
          <Pressable
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2 active:opacity-60"
          >
            <Ionicons name="arrow-back" size={22} color={dark ? "#a1a1aa" : "#71717a"} />
          </Pressable>
          <View>
            <Text className={`text-2xl font-bold ${dark ? "text-white" : "text-zinc-900"}`}>
              Send Audio
            </Text>
            <Text className={`text-sm mt-0.5 ${statusConfig[status].color}`}>
              {statusConfig[status].label}
            </Text>
          </View>

          {status === "live" && (
            <View className="ml-auto flex-row items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-emerald-400" />
              <Text className="text-emerald-400 text-xs font-semibold">LIVE</Text>
            </View>
          )}
        </View>

        {/* Server URL */}
        <View className="mb-4">
          <Text className={`text-xs font-medium tracking-widest uppercase mb-2 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
            Signaling Server
          </Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="ws://192.168.1.100:8080"
            placeholderTextColor={dark ? "#52525b" : "#a1a1aa"}
            editable={!isActive}
            autoCapitalize="none"
            autoCorrect={false}
            className={`rounded-xl px-4 py-3.5 text-base border ${
              dark
                ? "bg-zinc-900 border-zinc-800 text-white"
                : "bg-white border-zinc-200 text-zinc-900"
            }`}
          />
        </View>

        {/* Create Room Button */}
        {!isActive && (
          <Pressable
            onPress={() => createRoom(serverUrl)}
            disabled={!serverUrl.trim()}
            className={`rounded-xl px-6 py-4 items-center active:opacity-70 disabled:opacity-30 ${
              dark ? "bg-white" : "bg-zinc-900"
            }`}
          >
            <Text className={`text-base font-semibold ${dark ? "text-zinc-950" : "text-white"}`}>
              Create Room
            </Text>
          </Pressable>
        )}

        {/* Connecting loader */}
        {status === "connecting" && (
          <View className="items-center py-10 gap-3">
            <ActivityIndicator color={dark ? "#ffffff" : "#09090b"} />
            <Text className={`text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              Connecting to server...
            </Text>
          </View>
        )}

        {/* PIN Display */}
        {pin && status !== "connecting" && (
          <View className="mt-10 items-center">
            <Text className={`text-xs font-medium tracking-widest uppercase mb-4 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              Room Code
            </Text>
            <View className={`px-8 py-5 rounded-2xl border ${dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"}`}>
              <Text className={`text-3xl font-bold tracking-widest text-center ${dark ? "text-white" : "text-zinc-900"}`}>
                {pin}
              </Text>
            </View>
            <Text className={`text-sm mt-4 text-center ${dark ? "text-zinc-600" : "text-zinc-400"}`}>
              Share this code with the receiver
            </Text>
          </View>
        )}

        {/* Live — audio bars */}
        {status === "live" && (
          <View className="mt-10 items-center gap-2">
            <View className="flex-row items-end gap-1 h-10">
              {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
                <View
                  key={i}
                  className="w-2 bg-emerald-400 rounded-full"
                  style={{ height: `${h * 100}%`, opacity: 0.7 + i * 0.04 }}
                />
              ))}
            </View>
            <Text className={`text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              Streaming audio...
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <Text className="text-red-400 text-sm">{error}</Text>
          </View>
        )}

        {/* Disconnect */}
        {isActive && (
          <View className="absolute bottom-10 left-6 right-6">
            <Pressable
              onPress={disconnect}
              className={`rounded-xl px-6 py-4 items-center active:opacity-70 border ${
                dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              }`}
            >
              <Text className="text-red-500 text-base font-medium">Disconnect</Text>
            </Pressable>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}