module demo_system(
    input clk,
    input rst,
    input dir,
    output reg [3:0] count,
    output reg [7:0] shift,
    output wire parity,
    output wire zero,
    output wire carry,
    output wire overflow,
    output wire [3:0] leds
);

always @(posedge clk) begin
    if (rst) begin
        count <= 4'd0;
        shift <= 8'h01;
    end
    else begin
        if (dir)
            count <= count + 1;
        else
            count <= count - 1;

        shift <= {shift[6:0], shift[7]};
    end
end

assign parity  = ^shift;
assign zero    = (count == 4'd0);
assign carry   = (count == 4'hF);
assign overflow= (count == 4'h7);
assign leds    = count;

endmodule