import dayjs from 'dayjs';
import Browser from './browser';

class UI {
    static initializeUi() {
        const date = dayjs().format('YYYY-M-D');
        document.getElementById('book-title').placeholder = `EpubPressX ${date}`;
    }

    static setErrorMessage(msg) {
        $('#failure-message').text(msg);
    }

    static showSection(section) {
        UI.SECTIONS_SELECTORS.forEach((selector) => {
            if (selector === section) {
                $(selector).show();
            } else {
                $(selector).hide();
            }
        });
    }

    static setAlertMessage(message) {
        $('#alert-message').text(message);
    }

    static updateStatus(progress, message) {
        $('h4#progress-msg').text(message);
        if (progress) {
            return this.animateValueChange($('progress'), progress);
        }
        return Promise.resolve();
    }

    static animateValueChange($el, finalValue) {
        return new Promise((resolve) => {
            const animateFrom = (currentValue) => {
                requestAnimationFrame(() => {
                    if (currentValue === finalValue) {
                        setTimeout(resolve, 100);
                        return;
                    }
                    const diff = currentValue < finalValue ? 1 : -1;
                    const newValue = diff + currentValue;
                    $el.val(newValue);
                    animateFrom(newValue);
                });
            };
            animateFrom($el.val());
        });
    }

    static getCheckbox(props) {
        const html = `<div class="checkbox">
        <label>
        <input class='article-checkbox' type="checkbox" value="${props.url}" name="${props.id}">
        <span>${props.title}</span>
        </label>
        </div>`;
        return html;
    }

    static initializeTabList() {
        Browser.getCurrentWindowTabs().then((tabs) => {
            tabs.forEach((tab) => {
                $('#tab-list').append(UI.getCheckbox({
                    title: tab.title,
                    url: tab.url,
                    id: tab.id,
                }));
            });
        }).catch((error) => {
            UI.setErrorMessage(`Searching tabs failed: ${error}`);
        });
    }
}

UI.SECTIONS_SELECTORS = [
    '#downloadForm',
    '#settingsForm',
    '#downloadSpinner',
    '#downloadSuccess',
    '#downloadFailed',
];

export default UI;
