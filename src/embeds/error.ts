import { IconEmbedBuilder, Icon, ColorTable } from ".";

export class ErrorEmbed extends IconEmbedBuilder {
    constructor(title_text = "Error", add_default_description = true) {
        super(title_text, Icon.ERROR);
        this.setColor(ColorTable.ERROR);

        if (add_default_description) {
            this.setDescription("An error has occurred. Please try again later.");
        }
    }
}

export class ErrorEmbedWithLogging extends ErrorEmbed {
    constructor(error: Error, title_text = "Error") {
        super(title_text);
        console.error(error);
    }
}

export class OutOfRangeEmbed extends ErrorEmbed {
    constructor(field_name: string, lower_bound?: number, upper_bound?: number) {
        super(`${field_name} out of range`, false);
        
        if (lower_bound && upper_bound) {
            this.setDescription(`${field_name} must be between ${lower_bound} and ${upper_bound}.`);
        } else if (lower_bound) {
            this.setDescription(`${field_name} must be at least ${lower_bound}.`);
        } else if (upper_bound) {
            this.setDescription(`${field_name} must be at most ${upper_bound}.`);
        }
    }
}