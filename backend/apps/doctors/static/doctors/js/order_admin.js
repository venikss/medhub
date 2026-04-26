(function () {
    function extractPatientName(label) {
        if (!label) {
            return "";
        }
        var match = label.match(/^Encounter - (.*) with /);
        if (match && match[1]) {
            return match[1];
        }
        return label;
    }

    function updateEncounterPatientName() {
        var encounterSelect = document.getElementById("id_encounter");
        var patientField = document.getElementById("id_encounter_patient_name");
        if (!encounterSelect || !patientField) {
            return;
        }

        var selectedOption = encounterSelect.options[encounterSelect.selectedIndex];
        var selectedText = selectedOption ? selectedOption.text : "";

        if (!selectedText && window.django && window.django.jQuery) {
            var $ = window.django.jQuery;
            var select2Data = $(encounterSelect).select2("data");
            if (select2Data && select2Data.length) {
                selectedText = select2Data[0].text || "";
            }
        }

        patientField.value = extractPatientName(selectedText);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var encounterSelect = document.getElementById("id_encounter");
        if (!encounterSelect) {
            return;
        }

        updateEncounterPatientName();
        encounterSelect.addEventListener("change", updateEncounterPatientName);

        if (window.django && window.django.jQuery) {
            window.django.jQuery(encounterSelect).on("select2:select select2:clear", updateEncounterPatientName);
        }
    });
})();
