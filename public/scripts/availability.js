document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const addSlotBtn = document.getElementById('add-slot');
    const submitSlotsBtn = document.getElementById('submit-slots');
    const slotsList = document.getElementById('slots-list');
    
    // Add new time slot
    addSlotBtn.addEventListener('click', function() {
        const dateInput = document.getElementById('date');
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');
        
        // Validate inputs
        if (!dateInput.value || !startTimeInput.value || !endTimeInput.value) {
            alert('Please fill in all fields.');
            return;
        }
        
        // Validate time range
        if (startTimeInput.value >= endTimeInput.value) {
            alert('End time must be later than start time.');
            return;
        }
        
        // Create list item
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${dateInput.value}: ${startTimeInput.value} to ${endTimeInput.value}</span>
            <button class="remove-slot">Remove</button>
        `;
        
        // Store data attributes for submission
        li.dataset.date = dateInput.value;
        li.dataset.startTime = startTimeInput.value;
        li.dataset.endTime = endTimeInput.value;
        
        // Add remove button functionality
        li.querySelector('.remove-slot').addEventListener('click', function() {
            li.remove();
        });
        
        // Add to list
        slotsList.appendChild(li);
        
        // Clear inputs
        dateInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
    });
    
    // Submit all slots
    submitSlotsBtn.addEventListener('click', async function() {
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();
        
        // Validate email
        if (!email) {
            alert('Please enter your email.');
            return;
        }
        
        // Get all slots
        const slots = Array.from(slotsList.children).map(slot => ({
            date: slot.dataset.date,
            startTime: slot.dataset.startTime,
            endTime: slot.dataset.endTime
        }));
        
        // Validate slots
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
                    email: email,
                    slots: slots
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to submit availability');
            }
            
            const result = await response.json();
            alert('Availability submitted successfully!');
            
            // Clear form
            emailInput.value = '';
            slotsList.innerHTML = '';
            
        } catch (error) {
            console.error('Submission error:', error);
            alert('Error submitting availability. Please try again.');
        }
    });
});