import $ from 'jquery';

import Browser from './browser';
import UI from './ui';
import { generateEpub } from './generater';

/*
i18n
*/
$('#text-title').text(chrome.i18n.getMessage('textTitle'));
$('#auto-gen-title title').text(chrome.i18n.getMessage('textAutoGenTitle'));
// text-cover
$('#text-cover').text(chrome.i18n.getMessage('textCover'));
// text-include-images
$('#text-include-images').text(chrome.i18n.getMessage('textIncludeImages'));
// text-select-pages
$('#text-select-pages').text(chrome.i18n.getMessage('textSelectPages'));
// text-select-all
$('#select-all').text(chrome.i18n.getMessage('textSelectAll'));
// text-select-none
$('#select-none').text(chrome.i18n.getMessage('textSelectNone'));
// text-download
$('#download').text(chrome.i18n.getMessage('textDownload'));

/*
Download Form
*/

// auto generate title, base on first checked item
async function autoGenTitle() {
    const firstChecked = $('input.article-checkbox:checked')[0];
    if (firstChecked) {
        $('#text-title-container').addClass('loading');
        try {
            const title = firstChecked.nextElementSibling.textContent;
            // request server
            const response = await fetch(`https://book-title.sunxen.workers.dev?text=${encodeURIComponent(title)}`);
            const text = await response.text();
            $('#book-title').val(text);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            $('#text-title-container').removeClass('loading');
        }
    }
}

$('#gen-icon').on('click', () => {
    autoGenTitle();
});

function updateSelectedCount() {
    const selectedCount = $('input.article-checkbox:checked').length;
    if (selectedCount > 0) {
        $('#text-title-container').addClass('selected');
    } else {
        $('#text-title-container').removeClass('selected');
    }
}

$('#tab-list').on('change', 'input.article-checkbox', () => {
    updateSelectedCount();
});

$('#select-all').click(() => {
    $('input.article-checkbox').each((index, checkbox) => {
        $(checkbox).prop('checked', true);
    });
    updateSelectedCount();
});

$('#select-none').click(() => {
    $('input.article-checkbox').each((index, checkbox) => {
        $(checkbox).prop('checked', false);
    });
    updateSelectedCount();
});

$('#download').click(() => {
    const selectedItems = [];
    $('input.article-checkbox').each((index, checkbox) => {
        if ($(checkbox).prop('checked')) {
            selectedItems.push({
                url: $(checkbox).prop('value'),
                id: Number($(checkbox).prop('name')),
            });
        }
    });


    if (selectedItems.length <= 0) {
        $('#alert-message').text(chrome.i18n.getMessage('textNoItems'));
    } else {
        Browser.getTabsHtml(selectedItems).then((sections) => {
            UI.showSection('#downloadSpinner');
            const book = {
                title: $('#book-title').val() || $('#book-title').attr('placeholder'),
                coverPath: $('#book-cover').val() || undefined,
                includeImages: $('#include-images').prop('checked'),
                sections,
            };
            generateEpub(book).then((blob) => {
                chrome.downloads.download({
                    url: URL.createObjectURL(blob),
                    filename: `${book.title}.epub`,
                });
                UI.showSection('#downloadSuccess');
            });
        }).catch((error) => {
            UI.setErrorMessage(`Could not find tab content: ${error}`);
        });
    }
});

/*
Messaging
*/

Browser.onBackgroundMessage((request) => {
    if (request.action === 'download') {
        if (request.status === 'complete') {
            UI.updateStatus(100, 'Done!').then(() => {
                UI.showSection('#downloadSuccess');
            });
        } else {
            UI.showSection('#downloadFailed');
            if (request.error) {
                UI.setErrorMessage(request.error);
            }
        }
    } else if (request.action === 'publish') {
        UI.updateStatus(request.progress, request.message);
    }
});

/*
Startup
*/

window.onload = () => {
    UI.initializeUi();
    UI.showSection('#downloadForm');
    UI.initializeTabList();
};
