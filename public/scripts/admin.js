document.addEventListener('DOMContentLoaded', function() {
    const deleteButtons = document.querySelectorAll('.delete-btn');

    deleteButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const entryId = this.dataset.id;

            if (confirm('Are you sure you want to delete this entry?')) {
                try {
                    const response = await fetch(`/api/delete-entry/${entryId}`, {
                        method: 'DELETE',
                    });

                    const result = await response.json();
                    if (result.success) {
                        alert('Entry deleted successfully!');
                        location.reload(); // Reload to update the table
                    } else {
                        alert('Failed to delete entry. Please try again.');
                    }
                } catch (error) {
                    console.error('Error deleting entry:', error);
                    alert('Error deleting entry. Please try again.');
                }
            }
        });
    });
});
