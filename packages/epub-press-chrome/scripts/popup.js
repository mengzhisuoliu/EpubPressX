import $ from 'jquery';

import Browser from './browser';
import UI from './ui';
import { generateEpub } from './generater';

/*
i18n
*/
$('#text-title').text(chrome.i18n.getMessage('textTitle'));
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

// auto generate title
// when select the first page, make the page title as the book title
// when unselect all pages, clear the book title
function updateBookTitle() {
    const firstChecked = $('input.article-checkbox:checked')[0];
    if (firstChecked) {
        if (!$('#book-title').val()) {
            const title = firstChecked.nextElementSibling.textContent;
            $('#book-title').val(title.substring(0, 50));
        }
    } else {
        $('#book-title').val('');
    }
}

$('#tab-list').on('click', '.checkbox', () => {
    updateBookTitle();
});

$('#select-all').click(() => {
    $('input.article-checkbox').each((index, checkbox) => {
        $(checkbox).prop('checked', true);
    });
    updateBookTitle();
});

$('#select-none').click(() => {
    $('input.article-checkbox').each((index, checkbox) => {
        $(checkbox).prop('checked', false);
    });
    updateBookTitle();
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
