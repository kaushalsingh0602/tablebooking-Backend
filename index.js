const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb+srv://kaushalsingh8178:test@cluster0.bpai7.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});

// Table Schema
const TableSchema = new mongoose.Schema({
  size: Number,
  isAvailable: Boolean,
  canCombine: Boolean,
  bookedBy: String,
  position: Number,
  groupNumber: Number,
});

const Table = mongoose.model('Table', TableSchema);

// Helper function to allocate tables
function allocateTables(groupSize, tables) {
  tables.sort((a, b) => a.size - b.size);

  // 1. Try to find a single table that matches or exceeds the group size.
  for (let table of tables) {
    if (table.size >= groupSize && table.isAvailable && !table.canCombine) {
      return [table];
    }
  }

  // 2. Try to find the optimal combination of tables.
  let allocation = tryCombination(groupSize, tables);
  if (allocation.length > 0) {
    return allocation;
  }

  // 3. If no combination is found, try to use the smallest available larger table.
  return tryLargerTable(groupSize, tables);
}

// Function to attempt combining tables
function tryCombination(groupSize, tables) {
  let bestAllocation = [];
  let minimalWastage = Infinity;

  // Iterate over all possible pairs of tables for combinations
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const table1 = tables[i];
      const table2 = tables[j];

      if (table1.isAvailable && table2.isAvailable && table1.canCombine && table2.canCombine) {
        const combinedSize = table1.size + table2.size;

        if (combinedSize >= groupSize && combinedSize - groupSize < minimalWastage) {
          bestAllocation = [table1, table2];
          minimalWastage = combinedSize - groupSize;
        }
      }
    }
  }

  // Check for a single table if no suitable pair was found
  if (bestAllocation.length === 0) {
    for (let table of tables) {
      if (table.size >= groupSize && table.isAvailable) {
        return [table];
      }
    }
  }

  // Return the best allocation found
  return bestAllocation;
}

// Fallback: Use the largest available table if nothing else works
function tryLargerTable(groupSize, tables) {
  for (let table of tables.reverse()) {
    if (table.size >= groupSize && table.isAvailable) {
      return [table];
    }
  }
  return [];
}

// Booking Endpoint
app.post('/api/book', async (req, res) => {
  const { groupSize, name, groupNumber } = req.body;

  try {
    const tables = await Table.find({ isAvailable: true });

    const allocation = allocateTables(groupSize, tables);

    if (allocation.length > 0) {
      try {
        for (const table of allocation) {
          table.isAvailable = false;
          table.bookedBy = name;
          table.groupNumber = groupNumber;
          await table.save();
        }

        res.status(200).json({ message: 'Booking successful', allocatedTables: allocation });

      } catch (error) {
        console.error('Error updating tables:', error);
        res.status(500).json({ message: 'Booking failed due to an error' });
      }

    } else {
      res.status(400).json({ message: 'No suitable tables available' });
    }
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ message: 'Error fetching tables' });
  }
});

// Endpoint to reset table availability (for testing)
app.post('/api/reset', async (req, res) => {
  await Table.updateMany({}, { isAvailable: true, bookedBy: null, groupNumber: null });
  res.status(200).json({ message: 'All tables reset to available' });
});

// Create Tables Endpoint
app.post('/api/tables', async (req, res) => {
  const { tables } = req.body;
  try {
    await Table.insertMany(tables);
    res.status(200).json({ message: 'Tables created successfully' });
  } catch (error) {
    console.error('Error creating tables', error);
    res.status(500).json({ message: 'Error creating tables' });
  }
});

// Get all tables
app.get('/api/tables', async (req, res) => {
  const tables = await Table.find();
  res.status(200).json(tables);
});

// Server listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));