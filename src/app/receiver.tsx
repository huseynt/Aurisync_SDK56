import { View, Text, TextInput, Pressable, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function ReceiverScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  const [serverUrl, setServerUrl] = useState("ws://192.168.1.100:8080");
  const [pin, setPin] = useState("");

  const { status, error, joinRoom, disconnect } = useWebRTC({ role: "receiver" });

  const statusConfig = {
    idle:       { label: "Ready",              color: dark ? "text-zinc-500" : "text-zinc-400" },
    connecting: { label: "Connecting...",      color: "text-yellow-500" },
    waiting:    { label: "Joining room...",    color: "text-blue-500" },
    receiving:  { label: "Receiving",          color: "text-emerald-500" },
    live:       { label: "Live",               color: "text-emerald-500" },
    error:      { label: "Error",              color: "text-red-500" },
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
              Receive Audio
            </Text>
            <Text className={`text-sm mt-0.5 ${statusConfig[status].color}`}>
              {statusConfig[status].label}
            </Text>
          </View>

          {status === "receiving" && (
            <View className="ml-auto flex-row items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-emerald-400" />
              <Text className="text-emerald-400 text-xs font-semibold">LIVE</Text>
            </View>
          )}
        </View>

        {/* Server URL */}
        <View className="mb-6">
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

        {/* Room Code Input */}
        <View className="mb-6">
          <Text className={`text-xs font-medium tracking-widest uppercase mb-3 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
            Room Code
          </Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.toLowerCase().trim())}
            placeholder="abc12xyz9de"
            placeholderTextColor={dark ? "#52525b" : "#a1a1aa"}
            editable={!isActive}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            className={`rounded-xl px-4 py-3.5 text-xl font-bold tracking-widest border ${
              dark
                ? "bg-zinc-900 border-zinc-800 text-white"
                : "bg-white border-zinc-200 text-zinc-900"
            }`}
          />
        </View>

        {/* Join Button */}
        {!isActive && (
          <Pressable
            onPress={() => joinRoom(serverUrl, pin)}
            disabled={pin.length < 3 || !serverUrl.trim()}
            className={`rounded-xl px-6 py-4 items-center active:opacity-70 disabled:opacity-30 ${
              dark ? "bg-white" : "bg-zinc-900"
            }`}
          >
            <Text className={`text-base font-semibold ${dark ? "text-zinc-950" : "text-white"}`}>
              Join Room
            </Text>
          </Pressable>
        )}

        {/* Loader */}
        {(status === "connecting" || status === "waiting") && (
          <View className="items-center py-10 gap-3">
            <ActivityIndicator color={dark ? "#ffffff" : "#09090b"} />
            <Text className={`text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              {status === "connecting" ? "Connecting to server..." : "Joining room..."}
            </Text>
          </View>
        )}

        {/* Receiving state */}
        {status === "receiving" && (
          <View className="mt-10 items-center gap-4">
            <View className={`w-20 h-20 rounded-full items-center justify-center ${dark ? "bg-zinc-900" : "bg-zinc-100"}`}>
              <Ionicons name="headset-outline" size={36} color={dark ? "#34d399" : "#10b981"} />
            </View>
            <Text className={`text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
              Receiving audio...
            </Text>
            <View className="flex-row items-end gap-1 h-8">
              {[0.5, 0.8, 0.6, 1, 0.7, 0.9, 0.4].map((h, i) => (
                <View
                  key={i}
                  className="w-2 bg-emerald-400 rounded-full"
                  style={{ height: `${h * 100}%`, opacity: 0.6 + i * 0.05 }}
                />
              ))}
            </View>
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