document.addEventListener('DOMContentLoaded', function () {
    const addSlotBtn = document.getElementById('add-slot');
    const submitSlotsBtn = document.getElementById('submit-slots');
    const slotsList = document.getElementById('slots-list');
    const dateInput = document.getElementById('date');

    // Set default year to 2025 and restrict the date picker
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); // Tomorrow's date
    const maxDate = new Date(2025, 11, 31); // December 31, 2025

    dateInput.setAttribute('min', minDate.toISOString().split('T')[0]); // Set minimum date to tomorrow
    dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]); // Set maximum date to end of 2025

    // Add new time slot
    addSlotBtn.addEventListener('click', function () {
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');
        const locationSelect = document.getElementById('locations');

        // Validate inputs
        if (!dateInput.value || !startTimeInput.value || !endTimeInput.value) {
            alert('Please fill in all fields.');
            return;
        }

        const selectedDate = new Date(dateInput.value);
        if (selectedDate < minDate || selectedDate.getFullYear() !== 2025) {
            alert('Please choose a date in the year 2025 and at least one day in the future.');
            return;
        }

        if (startTimeInput.value >= endTimeInput.value) {
            alert('End time must be later than start time.');
            return;
        }

        // Get selected locations
        const selectedLocations = Array.from(locationSelect.selectedOptions).map(option => option.value);

        if (selectedLocations.length === 0) {
            alert('Please select at least one location.');
            return;
        }

        // Create list item
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${dateInput.value}: ${startTimeInput.value} to ${endTimeInput.value} at ${selectedLocations.join(', ')}</span>
            <button class="remove-slot">Remove</button>
        `;
        li.dataset.date = dateInput.value;
        li.dataset.startTime = startTimeInput.value;
        li.dataset.endTime = endTimeInput.value;
        li.dataset.locations = selectedLocations.join(',');

        li.querySelector('.remove-slot').addEventListener('click', function () {
            li.remove();
        });

        slotsList.appendChild(li);

        // Clear inputs
        dateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
        locationSelect.selectedIndex = -1;
    });

    // Submit all slots
    submitSlotsBtn.addEventListener('click', async function () {
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();

        if (!email) {
            alert('Please fill in your email.');
            return;
        }

        const slots = Array.from(slotsList.children).map(slot => ({
            date: slot.dataset.date,
            startTime: slot.dataset.startTime,
            endTime: slot.dataset.endTime,
            locations: slot.dataset.locations
        }));

        if (slots.length === 0) {
            alert('Please add at least one time slot.');
            return;
        }

        try {
            const response = await fetch('http://localhost:5500/api/submit-availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    slots
                })
            });

            if (!response.ok) throw new Error('Failed to submit availability.');

            alert('Availability submitted successfully!');
            emailInput.value = '';
            slotsList.innerHTML = '';
        } catch (error) {
            console.error('Submission error:', error);
            alert('Error submitting availability. Please try again.');
        }
    });
});
