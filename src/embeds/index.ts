import { ColorResolvable, EmbedBuilder } from "discord.js";

// enum of common icons, so that they can be replaced with custom ones if needed in the future
export enum Icon {
    NONE,

    SUCCESS = ":white_check_mark:",
    ERROR = ":x:",
    WARNING = ":warning:",

    INFO = ":information_source:",
    QUESTION = ":question:",
    DENIED = ":no_entry_sign:",

    MONEYBAG = ":moneybag:",
    CREDIT = ":credit_card:",
    CURRENCY = ":currency_exchange:",

    FLYING_CASH = ":money_with_wings:",
    MONEY_MOUTH = ":money_mouth:",

    DOLLAR = ":dollar:",
    YEN = ":yen:",
    EURO = ":euro:",
    POUND = ":pound:",

    COIN = ":coin:",

    SCALES = ":scales:",
    COMPANY = ":office:",
    BANK = ":bank:",

    SHOP = ":shopping_cart:",
    INVENTORY = ":briefcase:",

    CASINO = ":slot_machine:",
}

// same as Icon, but with the actual emoji instead of the name
export enum NativeIcon {
    NONE,

    SUCCESS = "✅",
    ERROR = "❌",
    WARNING = "⚠️",

    INFO = "ℹ️",
    QUESTION = "❓",
    DENIED = "⛔",

    MONEYBAG = "💰",
    CREDIT = "💳",
    CURRENCY = "💱",

    FLYING_CASH = "💸",
    MONEY_MOUTH = "🤑",

    DOLLAR = "💵",
    YEN = "💴",
    EURO = "💶",
    POUND = "💷",

    COIN = "🪙",

    SCALES = "⚖️",
    COMPANY = "🏢",
    BANK = "🏦",

    SHOP = "🛒",
    INVENTORY = "💼",

    CASINO = "🎰",
}

// dict of common colors, so that they can be replaced if needed in the future
export const ColorTable: { [name: string]: ColorResolvable } = {
    SUCCESS: "#00ff00",
    ERROR: "#ff0000",
    WARNING: "#ffff00",

    INFO: "#0000ff",
    QUESTION: "#ff00ff",
    DENIED: "#ed2939",

    MONEY: "#3e9c35",
    CREDIT: "#ffa366",
    COMPANY: "#405ce6",
    BANK: "#3e9c35",

    SHOP: "#ff66cc",
    INVENTORY: "#ff6600",

    CASINO: "#ffcc00",
};


// alternative embedbuilder that accepts a title and an icon separately
export class IconEmbedBuilder extends EmbedBuilder {
    #icon: Icon = Icon.NONE;
    #title_text: string = "";
    #icon_enabled: boolean = true;

    set icon(icon: Icon) {
        this.#icon = icon;
    }

    set title_text(title: string) {
        this.#title_text = title;
    }

    set_icon_enabled(enabled: boolean) {
        this.#icon_enabled = enabled;
    }

    apply_title() {
        if (this.#icon_enabled) {
            this.setTitle(`${this.#icon} ${this.#title_text}`);
        } else {
            this.setTitle(this.#title_text);
        }
    }

    constructor(title_text?: string, icon?: Icon) {
        super();

        if (title_text) {
            this.title_text = title_text;
        }

        if (icon) {
            this.icon = icon;
        }

        this.apply_title();
    }
}
