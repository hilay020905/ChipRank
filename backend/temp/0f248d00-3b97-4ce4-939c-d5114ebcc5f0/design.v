module fifo_async #(parameter DEPTH=16) (
  input  wr_clk, rd_clk, rst_n,
  input  wr_en, rd_en,
  input  [7:0] wr_data,
  output reg [7:0] rd_data,
  output full, empty
);
  localparam PTR = $clog2(DEPTH);
  reg [7:0] mem [0:DEPTH-1];
  reg [PTR:0] wr_ptr, rd_ptr;

  // TODO: Gray-code sync, full/empty flags

endmodule