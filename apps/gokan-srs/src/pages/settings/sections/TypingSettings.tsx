import { SettingToggle } from "../../../components/ui/SettingToggle";
import { Disclosure } from "../../../components/ui/Disclosure";
import type { UserSettings } from "../../../models/user.model";

/** Where each platform adds a Japanese keyboard, for the "Typing kanji" note. */
const JAPANESE_KEYBOARDS: { platform: string; steps: string }[] = [
    { platform: 'Windows', steps: 'Settings › Time & language › Language & region › Add a language › Japanese. Switch with Windows + Space.' },
    { platform: 'Mac', steps: 'System Settings › Keyboard › Text Input › Edit › + › Japanese (Romaji). Switch with Control + Space.' },
    { platform: 'iPhone and iPad', steps: 'Settings › General › Keyboard › Keyboards › Add New Keyboard › Japanese › Romaji. Switch with the globe key.' },
    { platform: 'Android', steps: 'In Gboard: Settings › Languages › Add keyboard › Japanese. Switch with the globe key.' },
    { platform: 'Linux', steps: 'Install Mozc for your input method (fcitx5-mozc or ibus-mozc) and add it as an input source.' },
];

interface TypingSettingsProps {
    settings: UserSettings;
    onUpdateSettings: (settings: UserSettings) => void;
}

/**
 * How Japanese answers are typed, for every activity: romaji converted to kana in
 * the field (AnswerInput), and, collapsed, how to add a Japanese keyboard for kanji,
 * which the converter never writes.
 */
export function TypingSettings({ settings, onUpdateSettings }: TypingSettingsProps) {
    return (
        <div className="space-y-4">
            <SettingToggle
                label="Type romaji as kana"
                description={<>Japanese answers turn romaji into hiragana as you type: taberu becomes <span lang="ja" className="font-gothic">たべる</span>. A Japanese keyboard works either way.</>}
                checked={settings.romajiInput}
                onChange={(checked) => onUpdateSettings({ ...settings, romajiInput: checked })}
            />
            <Disclosure title="Typing kanji">
                <p className="type-support">
                    Romaji gives kana only, and every answer accepts kana. To type kanji, add a Japanese
                    keyboard; it converts as you type and offers the kanji for each word.
                </p>
                <dl className="mt-3 space-y-2">
                    {JAPANESE_KEYBOARDS.map(({ platform, steps }) => (
                        <div key={platform}>
                            <dt className="font-sans text-sm font-medium text-primary">{platform}</dt>
                            <dd className="type-support">{steps}</dd>
                        </div>
                    ))}
                </dl>
            </Disclosure>
        </div>
    );
}
