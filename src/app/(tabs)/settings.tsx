import { View, Text, Pressable, ScrollView, Switch, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";

type SettingRowProps = {
  label: string;
  description?: string;
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  rightText?: string;
};

function SettingRow({ label, description, value, onToggle, onPress, rightText }: SettingRowProps) {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-4 active:opacity-60"
    >
      <View className="flex-1 mr-4">
        <Text className={`text-base ${dark ? "text-white" : "text-zinc-900"}`}>
          {label}
        </Text>
        {description && (
          <Text className={`text-sm mt-0.5 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
            {description}
          </Text>
        )}
      </View>
      {onToggle !== undefined && value !== undefined ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: dark ? "#3f3f46" : "#d4d4d8", true: dark ? "#ffffff" : "#09090b" }}
          thumbColor={value ? (dark ? "#09090b" : "#ffffff") : (dark ? "#a1a1aa" : "#ffffff")}
        />
      ) : rightText ? (
        <Text className={`text-sm ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
          {rightText}
        </Text>
      ) : (
        <Text className={`text-lg ${dark ? "text-zinc-600" : "text-zinc-400"}`}>›</Text>
      )}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  return (
    <Text className={`text-xs font-medium tracking-widest uppercase mb-2 mt-6 ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
      {title}
    </Text>
  );
}

function Divider() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";
  return <View className={`h-px ${dark ? "bg-zinc-800" : "bg-zinc-100"}`} />;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const dark = colorScheme === "dark";

  const [noiseCancel, setNoiseCancel] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  const cardClass = `rounded-2xl px-4 ${dark ? "bg-zinc-900" : "bg-white border border-zinc-200"}`;

  return (
    <SafeAreaView className={`flex-1 ${dark ? "bg-zinc-950" : "bg-zinc-50"}`}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="pt-6 pb-2">
          <Text className={`text-sm font-medium tracking-widest uppercase ${dark ? "text-zinc-500" : "text-zinc-400"}`}>
            Aurisync
          </Text>
          <Text className={`text-3xl font-bold mt-2 ${dark ? "text-white" : "text-zinc-900"}`}>
            Settings
          </Text>
        </View>

        {/* Audio */}
        <SectionHeader title="Audio" />
        <View className={cardClass}>
          <SettingRow
            label="Noise Cancellation"
            description="Reduce background noise while sending"
            value={noiseCancel}
            onToggle={setNoiseCancel}
          />
          <Divider />
          <SettingRow
            label="Keep Screen Awake"
            description="Prevent screen sleep during streaming"
            value={keepAwake}
            onToggle={setKeepAwake}
          />
          <Divider />
          <SettingRow
            label="Audio Quality"
            description="Bitrate and codec settings"
            rightText="High"
            onPress={() => {}}
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="Privacy" />
        <View className={cardClass}>
          <SettingRow
            label="No Recording"
            description="Audio is never stored on any server"
            rightText="Always on"
          />
          <Divider />
          <SettingRow
            label="Analytics"
            description="Help improve the app anonymously"
            value={analytics}
            onToggle={setAnalytics}
          />
          <Divider />
          <SettingRow
            label="Privacy Policy"
            onPress={() => {}}
          />
        </View>

        {/* FAQ */}
        <SectionHeader title="FAQ" />
        <View className={cardClass}>
          <SettingRow
            label="How does P2P work?"
            description="Devices connect directly — no cloud storage"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            label="Is it end-to-end encrypted?"
            description="Yes, via WebRTC DTLS-SRTP protocol"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            label="What is a PIN code?"
            description="A 5-digit room ID to pair two devices"
            onPress={() => {}}
          />
          <Divider />
          <SettingRow
            label="Why do I need a real device?"
            description="Simulators don't support microphone input"
            onPress={() => {}}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View className={cardClass}>
          <SettingRow label="Version" rightText="1.0.0" />
          <Divider />
          <SettingRow label="Licenses" onPress={() => {}} />
        </View>

        <View className="h-12" />
      </ScrollView>
    </SafeAreaView>
  );
}